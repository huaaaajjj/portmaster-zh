//! Shared, display-only Chinese notification text. Records and action payloads stay untouched.
use crate::portapi::models::notification::{Action, Notification};
use lazy_static::lazy_static;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize)]
struct Catalog {
    messages: Vec<MessageRule>,
    actions: Vec<ActionRule>,
}
#[derive(Deserialize)]
struct MessageRule {
    events: Vec<String>,
    title: [String; 2],
    message: [String; 2],
    #[serde(default)]
    numbers: Vec<String>,
    #[serde(rename = "requiredAction")]
    required_action: Option<String>,
}
#[derive(Deserialize)]
struct ActionRule {
    events: Vec<String>,
    source: String,
    target: String,
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "Type")]
    action_type: String,
    #[serde(rename = "Visibility")]
    visibility: String,
    #[serde(rename = "Payload")]
    payload: Option<Value>,
    #[serde(rename = "notificationType")]
    notification_type: Option<i32>,
    #[serde(default, rename = "ignoreVisibility")]
    ignore_visibility: bool,
    #[serde(rename = "payloadFrom")]
    payload_from: Option<String>,
    #[serde(rename = "settingFromEvent")]
    setting_from_event: Option<String>,
    #[serde(rename = "profileIndex")]
    profile_index: Option<usize>,
}
lazy_static! {
    // ponytail: this fork ships zh-CN; embed it, never fetch translations at runtime.
    static ref CATALOG: Option<Catalog> = serde_json::from_str(include_str!(
        "../../../../angular/src/i18n/notifications.zh-CN.json"
    )).ok();
}
fn matches_event(events: &[String], id: &str) -> bool {
    events.iter().any(|event| match event.strip_suffix('*') {
        Some(prefix) => id.starts_with(prefix),
        None => id == event,
    })
}

// No regex/backtracking or language guesses: ambiguous delimiters retain the whole source.
fn match_template(mut template: &str, mut value: &str, params: &mut HashMap<String, String>) -> Option<()> {
    while let Some((prefix, rest)) = template.split_once("{{") {
        value = value.strip_prefix(prefix)?;
        let (name, after) = rest.split_once("}}")?;
        if !params.contains_key(name) {
            let delimiter = after.split("{{").next()?;
            let end = if delimiter.is_empty() { value.len() } else {
                let end = value.find(delimiter)?;
                // Match TS's overlapping-delimiter check, advancing by one Unicode scalar.
                let next = end + value[end..].chars().next()?.len_utf8();
                if value[next..].contains(delimiter) { return None; }
                end
            };
            params.insert(name.to_string(), value[..end].to_string());
        }
        value = value.strip_prefix(params.get(name)?.as_str())?;
        template = after;
    }
    (value == template).then_some(())
}
fn render(mut template: &str, params: &HashMap<String, String>) -> Option<String> {
    let mut text = String::new();
    while let Some((prefix, rest)) = template.split_once("{{") {
        let (name, after) = rest.split_once("}}")?;
        text.push_str(prefix);
        text.push_str(params.get(name)?);
        template = after;
    }
    text.push_str(template);
    Some(text)
}

pub fn localize_notification(n: &Notification) -> (String, String) {
    let raw = || (n.title.clone(), n.message.clone());
    if n.event_id.starts_with("broadcasts:") { return raw(); }
    let catalog = match CATALOG.as_ref() { Some(catalog) => catalog, None => return raw() };
    for rule in &catalog.messages {
        if !matches_event(&rule.events, &n.event_id) { continue; }
        if let Some(id) = &rule.required_action {
            if n.notification_type != crate::portapi::models::notification::PROMPT
                || !n.actions.iter().any(|a| &a.id == id && a.action_type.is_empty()) { continue; }
        }
        let mut params = HashMap::new();
        if match_template(&rule.title[0], &n.title, &mut params).is_none()
            || match_template(&rule.message[0], &n.message, &mut params).is_none() { continue; }
        if rule.numbers.iter().any(|name| params.get(name).map_or(true, |s|
            s.is_empty() || !s.bytes().all(|c| c.is_ascii_digit()))) { continue; }
        if let (Some(title), Some(message)) = (render(&rule.title[1], &params), render(&rule.message[1], &params)) {
            return (title, message);
        }
    }
    raw()
}

pub fn localize_action(n: &Notification, action: &Action) -> String {
    if n.event_id.starts_with("broadcasts:") { return action.text.clone(); }
    let catalog = match CATALOG.as_ref() { Some(catalog) => catalog, None => return action.text.clone() };
    for rule in &catalog.actions {
        if !matches_event(&rule.events, &n.event_id) || action.text != rule.source
            || action.id != rule.id || action.action_type != rule.action_type
            || (!rule.ignore_visibility && action.visibility != rule.visibility) { continue; }
        if let Some(kind) = rule.notification_type {
            if serde_json::to_value(&n.notification_type).ok() != Some(Value::from(kind)) { continue; }
        }
        if let Some(payload) = &rule.payload {
            if &action.payload != payload { continue; }
        }
        if let Some(field) = &rule.payload_from {
            if action.payload.as_str().map_or(true, str::is_empty) || n.data.get(field) != Some(&action.payload) { continue; }
        }
        if let Some(prefix) = &rule.setting_from_event {
            if action.payload != serde_json::json!({ "Key": &n.event_id[prefix.len()..], "Profile": "" }) { continue; }
        }
        if let Some(index) = rule.profile_index {
            let profiles: Vec<_> = [1, 2].iter().map(|index| n.actions.iter().find(|a|
                a.text == format!("Change ({})", index) && a.action_type == "open-profile"
                && a.id.is_empty() && a.visibility.is_empty()).and_then(|a| a.payload.as_str())).collect();
            if let (Some(first), Some(second)) = (profiles[0], profiles[1]) {
                if first.is_empty() || second.is_empty() || n.event_id != format!("profiles:match-conflict:{}:{}", first, second)
                    || action.payload.as_str() != profiles.get(index.wrapping_sub(1)).copied().flatten() { continue; }
            } else { continue; }
        }
        return rule.target.clone();
    }
    action.text.clone()
}

pub fn system_actions(n: &Notification) -> Vec<(&str, String)> {
    n.actions.iter().filter(|a| a.visibility.is_empty())
        .map(|action| (action.id.as_str(), localize_action(n, action))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn templates_preserve_unicode_and_do_not_expand_parameter_contents() {
        assert!(CATALOG.is_some(), "Invalid embedded notification catalog");
        let mut params = HashMap::new();
        assert!(match_template("Before {{NAME}} after", "Before 应用 {{OTHER}} after", &mut params).is_some());
        assert_eq!(render("名称：{{NAME}}", &params).unwrap(), "名称：应用 {{OTHER}}");
        assert!(match_template("Before {{VALUE}} after", "Before one after two after", &mut HashMap::new()).is_none());
    }

    #[test]
    fn absent_or_null_actions_do_not_drop_an_actionless_notification() {
        let mut n = serde_json::json!({
            "EventID": "nameserver:listener-failed", "GUID": "test", "Type": 3,
            "Title": "Secure DNS Error", "Message": "raw error", "Category": "",
            "EventData": null, "Expires": 0, "State": "active", "SelectedActionID": "",
            "ShowOnSystem": true, "AvailableActions": null
        });
        assert!(serde_json::from_value::<Notification>(n.clone()).unwrap().actions.is_empty());
        n.as_object_mut().unwrap().remove("AvailableActions");
        assert!(serde_json::from_value::<Notification>(n.clone()).unwrap().actions.is_empty());
        n["AvailableActions"] = Value::String("invalid".to_string());
        assert!(serde_json::from_value::<Notification>(n).is_err());
    }
}
