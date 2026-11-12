use super::notification_text::{localize_notification, system_actions};
use crate::portapi::client::*;
use crate::portapi::message::*;
use crate::portapi::models::notification::*;
use crate::portapi::types::*;
use log::error;
use serde_json::json;
use tauri::async_runtime;

pub async fn notification_handler(cli: PortAPI) {
    let res = cli
        .request(Request::QuerySubscribe("query notifications:".to_string()))
        .await;

    if let Ok(mut rx) = res {
        while let Some(msg) = rx.recv().await {
            let res = match msg {
                Response::Ok(key, payload) => Some((key, payload)),
                Response::New(key, payload) => Some((key, payload)),
                Response::Update(key, payload) => Some((key, payload)),
                _ => None,
            };

            if let Some((key, payload)) = res {
                match payload.parse::<Notification>() {
                    Ok(n) => {
                        // Skip if this one should not be shown using the system notifications
                        if !n.show_on_system {
                            continue;
                        }

                        // Skip if this action has already been acted on
                        if !n.selected_action_id.is_empty() {
                            continue;
                        }
                        show_notification(&cli, key, n).await;
                    }
                    Err(err) => match err {
                        ParseError::Json(err) => {
                            error!("failed to parse notification: {}", err);
                        }
                        _ => {
                            error!("unknown error when parsing notifications payload");
                        }
                    },
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
pub async fn show_notification(cli: &PortAPI, key: String, n: Notification) {
    let (title, message) = localize_notification(&n);
    let mut notif = notify_rust::Notification::new();
    notif.body(&message);
    notif.timeout(notify_rust::Timeout::Never); // TODO(ppacher): use n.expires to calculate the timeout.
    notif.summary(&title);
    notif.icon("portmaster");

    for (id, label) in system_actions(&n) {
        notif.action(id, &label);
    }

    {
        let cli_clone = cli.clone();
        async_runtime::spawn(async move {
            let res = notif.show();
            // TODO(ppacher): keep a reference of open notifications and close them
            // if the user reacted inside the UI:
            match res {
                Ok(handle) => {
                    handle.wait_for_action(|action| {
                        match action {
                            "__closed" => {
                                // timeout
                            }

                            value => {
                                let value = value.to_string().clone();

                                async_runtime::spawn(async move {
                                    let _ = cli_clone
                                        .request(Request::Update(
                                            key,
                                            Payload::Json(
                                                json!({
                                                    "SelectedActionID": value
                                                })
                                                .to_string(),
                                            ),
                                        ))
                                        .await;
                                });
                            }
                        }
                    })
                }
                Err(err) => {
                    error!("failed to display notification: {}", err);
                }
            }
        });
    }
}

#[cfg(target_os = "windows")]
pub async fn show_notification(cli: &PortAPI, key: String, n: Notification) {
    use tauri_winrt_notification::{Duration, Sound, Toast};

    let (title, message) = localize_notification(&n);
    let mut toast = Toast::new("io.safing.portmaster")
        .title(&title)
        .text1(&message)
        .sound(Some(Sound::Default))
        .duration(Duration::Long);

    for (id, label) in system_actions(&n) {
        toast = toast.add_button(&label, id);
    }
    {
        let cli = cli.clone();
        toast = toast.on_activated(move |action| -> windows::core::Result<()> {
            if let Some(value) = action {
                let cli = cli.clone();
                let key = key.clone();
                async_runtime::spawn(async move {
                    let _ = cli
                        .request(Request::Update(
                            key,
                            Payload::Json(
                                json!({
                                    "SelectedActionID": value
                                })
                                .to_string(),
                            ),
                        ))
                        .await;
                });
            } else {               
                error!("Notification clicked but no action associated.");
                // TODO(vladimir): If Action is None, the user clicked on the notification. Focus on the UI.
            }
            Ok(())
        });
    }
    toast.show().expect("unable to send notification");
    // TODO(vladimir): keep a reference of open notifications and close them
    // if the user reacted inside the UI:
}
