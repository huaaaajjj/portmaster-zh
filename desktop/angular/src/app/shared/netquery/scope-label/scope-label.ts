import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ScopeIdentifier } from '@safing/portmaster-api';
import { connectionValueLabel } from '../utils';
import { parseDomain } from '../../utils';

@Component({
  selector: 'sfng-netquery-scope-label',
  templateUrl: 'scope-label.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SfngNetqueryScopeLabelComponent implements OnChanges {
  readonly scopeTranslation = new Map<string, string>([
    [ScopeIdentifier.IncomingHost, $localize`:@@netquery.scopeIdentifier.IncomingHost:Device-Local Incoming`],
    [ScopeIdentifier.IncomingLAN, $localize`:@@netquery.scopeIdentifier.IncomingLAN:LAN Incoming`],
    [ScopeIdentifier.IncomingInternet, $localize`:@@netquery.scopeIdentifier.IncomingInternet:Internet Incoming`],
    [ScopeIdentifier.PeerHost, $localize`:@@netquery.scopeIdentifier.PeerHost:Device-Local Outgoing`],
    [ScopeIdentifier.PeerLAN, $localize`:@@netquery.scopeIdentifier.PeerLAN:LAN Peer-to-Peer`],
    [ScopeIdentifier.PeerInternet, $localize`:@@netquery.scopeIdentifier.PeerInternet:Internet Peer-to-Peer`],
    [ScopeIdentifier.IncomingInvalid, connectionValueLabel('', null)],
    [ScopeIdentifier.PeerInvalid, connectionValueLabel('', null)],
  ]);
  readonly notAvailable = connectionValueLabel('', null);

  @Input()
  scope?: string = ''

  @Input()
  set leftRightFix(v: any) {
    console.warn("deprecated @Input usage")
  }
  get leftRightFix() { return false }

  domain: string = '';
  subdomain: string = '';

  ngOnChanges(change: SimpleChanges) {
    if (!!change['scope']) {
      const scope = change.scope.currentValue || '';
      const result = this.scopeTranslation.has(scope) ? null : parseDomain(scope);

      this.domain = result?.domain || '';
      this.subdomain = result?.subdomain || '';
    }
  }
}
