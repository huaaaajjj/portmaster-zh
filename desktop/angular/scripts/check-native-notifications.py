#!/usr/bin/env python3
"""Check actual Rust notification display code offline, without Tauri or OS delivery."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    repo = Path(__file__).resolve().parents[3]
    rust = repo / 'desktop/tauri/src-tauri/src'
    with tempfile.TemporaryDirectory(prefix='notification-native-check-') as tmp:
        work = Path(tmp)
        (work / 'Cargo.toml').write_text('''[package]
name = "notification-display-check"
version = "0.0.0"
edition = "2021"
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
lazy_static = "1.4"
[[bin]]
name = "notification-display-check"
path = "main.rs"
''', encoding='utf-8')
        model = json.dumps((rust / 'portapi/models/notification.rs').as_posix())
        helper = json.dumps((rust / 'portmaster/notification_text.rs').as_posix())
        (work / 'main.rs').write_text('''use std::io::{self, Read};
mod portapi { pub mod models { #[path = MODEL] pub mod notification; } }
#[path = HELPER] mod notification_text;
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let records: Vec<portapi::models::notification::Notification> = serde_json::from_str(&input).unwrap();
    let values: Vec<_> = records.iter().map(|n| {
        let (title, message) = notification_text::localize_notification(n);
        let actions: Vec<_> = n.actions.iter().map(|a| notification_text::localize_action(n, a)).collect();
        serde_json::json!({ "title": title, "message": message, "actions": actions,
            "systemActions": notification_text::system_actions(n), "record": n })
    }).collect();
    println!("{}", serde_json::to_string(&values).unwrap());
}
'''.replace('MODEL', model).replace('HELPER', helper), encoding='utf-8')
        manifest = str(work / 'Cargo.toml')
        subprocess.run(['cargo', 'test', '--offline', '--manifest-path', manifest], check=True, cwd=repo)
        subprocess.run(['cargo', 'build', '--offline', '--manifest-path', manifest], check=True, cwd=repo)
        binary = work / 'target/debug' / ('notification-display-check.exe' if os.name == 'nt' else 'notification-display-check')
        subprocess.run(['node', str(repo / 'desktop/angular/scripts/check-notifications.mjs'), '--native', str(binary)], check=True, cwd=repo)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
