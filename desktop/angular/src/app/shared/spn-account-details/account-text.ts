// Exact account display text from spn/access/{api.go,account/view.go} only.
// Keep profile state, plan names, credentials and API payloads unchanged.
export const subscriptionStateLabels = new Map<string, string>([
  ['manual', $localize`:@@spn.subscription.manual:Manual`],
  ['active', $localize`:@@spn.subscription.active:Active`],
  ['cancelled', $localize`:@@spn.subscription.cancelled:Cancelled`],
]);

export const accountStateLabels = new Map<string, string>([
  ['', $localize`:@@spn.account.state.none:Not logged in`],
  ['fresh', $localize`:@@spn.account.state.fresh:Fresh`],
  ['queued', $localize`:@@spn.account.state.queued:Queued`],
  ['approved', $localize`:@@spn.account.state.approved:Approved`],
  ['suspended', $localize`:@@spn.account.state.suspended:Suspended`],
  ['loggedout', $localize`:@@spn.account.state.loggedOut:Logged out`],
]);

const accountResponses = new Map<string, string>([
  ['Login with your SPN account.', $localize`:@@spn.account.response.loginRequired:Login with your SPN account.`],
  ['invalid credentials', $localize`:@@spn.account.response.invalidCredentials:invalid credentials`],
  ['device limit reached', $localize`:@@spn.account.response.deviceLimit:device limit reached`],
  ['device is locked', $localize`:@@spn.account.response.deviceLocked:device is locked`],
  ['not logged in', $localize`:@@spn.account.response.notLoggedIn:not logged in`],
  ['Logged out.', $localize`:@@spn.account.response.loggedOut:Logged out.`],
  ['Logged out and user data purged.', $localize`:@@spn.account.response.loggedOutAndPurged:Logged out and user data purged.`],
]);

export function localizeSPNAccountResponse(message: string, username?: string): string {
  // Go's http.Error adds one newline; never normalize an unknown response.
  const known = accountResponses.get(message.replace(/\n$/, ''));
  if (known !== undefined) {
    return known;
  }

  // Match the submitted username exactly, so delimiters in names remain data.
  const prefix = `Now logged in as ${username} as device `;
  if (username && message.startsWith(prefix) && message.length > prefix.length) {
    const deviceName = message.slice(prefix.length);
    return $localize`:@@spn.account.response.loggedIn:Now logged in as ${username}:USERNAME: as device ${deviceName}:DEVICE_NAME:`;
  }

  return message;
}

const accountViewDetails = new Map<string, string>([
  ['This device may have been deactivated or removed from your account. Please log in again.', $localize`:@@spn.account.view.deviceRemoved:This device may have been deactivated or removed from your account. Please log in again.`],
  ['Get more features. Upgrade today.', $localize`:@@spn.account.view.upgrade:Get more features. Upgrade today.`],
  ['Your auto-renewal seems to be delayed. Please refresh and check the status of your payment. Payment information may be delayed.', $localize`:@@spn.account.view.renewalDelayed:Your auto-renewal seems to be delayed. Please refresh and check the status of your payment. Payment information may be delayed.`],
  ['Your subscription will auto-renew soon. Please note that payment information may be delayed.', $localize`:@@spn.account.view.renewalSoon:Your subscription will auto-renew soon. Please note that payment information may be delayed.`],
  ['Your package has ended. Extend it on the Account Page.', $localize`:@@spn.account.view.packageEnded:Your package has ended. Extend it on the Account Page.`],
  ['Your package ends soon. Extend it on the Account Page.', $localize`:@@spn.account.view.packageEnding:Your package ends soon. Extend it on the Account Page.`],
]);

const accountViewWarnings = new Map<string, string>([
  ['There is an unknown error in the communication with the account server. The shown information may not be accurate. ', $localize`:@@spn.account.view.unknownError:There is an unknown error in the communication with the account server. The shown information may not be accurate.`],
  ['Portmaster could not connect to the account server. The shown information may not be accurate. ', $localize`:@@spn.account.view.connectionError:Portmaster could not connect to the account server. The shown information may not be accurate.`],
]);

function localizeViewDetail(message: string): string | undefined {
  const known = accountViewDetails.get(message);
  if (known !== undefined) {
    return known;
  }

  const suspended = /^Your account \(([\s\S]*)\) was suspended\. Please contact support for details\.$/.exec(message);
  if (suspended) {
    return $localize`:@@spn.account.view.suspended:Your account (${suspended[1]}:USERNAME:) was suspended. Please contact support for details.`;
  }

  const ended = /^Your package ([\s\S]+) has ended\. Extend it on the Account Page\.$/.exec(message);
  if (ended) {
    return $localize`:@@spn.account.view.namedPackageEnded:Your package ${ended[1]}:PLAN_NAME: has ended. Extend it on the Account Page.`;
  }

  return undefined;
}

export function localizeSPNAccountView(message: string | null | undefined): string {
  const source = message ?? '';
  for (const [prefix, warning] of accountViewWarnings) {
    if (source.startsWith(prefix)) {
      const remainder = source.slice(prefix.length);
      if (!remainder) {
        return warning;
      }
      const detail = localizeViewDetail(remainder);
      // ponytail: only complete known view messages; new server wording stays intact.
      return detail === undefined ? source : $localize`:@@spn.account.view.withWarning:${warning}:WARNING: ${detail}:DETAIL:`;
    }
  }

  return localizeViewDetail(source) ?? source;
}
