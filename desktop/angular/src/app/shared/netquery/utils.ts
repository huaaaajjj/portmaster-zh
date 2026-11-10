import { Condition, IPScope, Matcher, Verdict } from "@safing/portmaster-api";
import { objKeys } from "../utils";

export const connectionFieldTranslation: { [key: string]: string } = {
  domain: $localize`:@@netquery.field.domain:Domain`,
  profile: $localize`:@@netquery.field.profile:App`,
  path: $localize`:@@netquery.field.path:Binary Path`,
  scope: $localize`:@@netquery.field.scope:Scope`,
  as_owner: $localize`:@@netquery.field.as_owner:Provider`,
  country: $localize`:@@netquery.field.country:Country`,
  direction: $localize`:@@netquery.field.direction:Direction`,
  started: $localize`:@@netquery.field.started:Started`,
  ended: $localize`:@@netquery.field.ended:Ended`,
  remote_ip: $localize`:@@netquery.field.remote_ip:Remote IP`,
  verdict: $localize`:@@netquery.field.verdict:Verdict`,
  encrypted: $localize`:@@netquery.field.encrypted:Encrypted`,
  internal: $localize`:@@netquery.field.internal:Internal`,
  asn: $localize`:@@netquery.field.asn:ASN`,
  tunneled: $localize`:@@netquery.field.tunneled:SPN Active`,
  active: $localize`:@@netquery.field.active:Active`,
  allowed: $localize`:@@netquery.field.allowed:Allowed`,
  from: $localize`:@@netquery.field.from:From`,
  to: $localize`:@@netquery.field.to:To`,
  remote_port: $localize`:@@netquery.field.remote_port:Port`,
  bytes_sent: $localize`:@@netquery.field.bytes_sent:Bytes Sent`,
  bytes_received: $localize`:@@netquery.field.bytes_received:Bytes Received`,
  local_ip: $localize`:@@netquery.field.local_ip:Local IP`,
  local_port: $localize`:@@netquery.field.local_port:Local Port`,
  ip_protocol: $localize`:@@netquery.field.ip_protocol:Protocol`,
  type: $localize`:@@netquery.field.type:Connection Type`,
  profile_revision: $localize`:@@netquery.field.profile_revision:Profile Revision`,
  exit_node: $localize`:@@netquery.field.exit_node:Exit Node`,
}

const scopeLabels = new Map<string, string>([
  [String(IPScope.Invalid), $localize`:@@netquery.scope.Invalid:Invalid`],
  [String(IPScope.Undefined), $localize`:@@netquery.scope.Undefined:Undefined`],
  [String(IPScope.HostLocal), $localize`:@@netquery.scope.HostLocal:Device Local`],
  [String(IPScope.LinkLocal), $localize`:@@netquery.scope.LinkLocal:Link Local`],
  [String(IPScope.SiteLocal), $localize`:@@netquery.scope.SiteLocal:LAN`],
  [String(IPScope.Global), $localize`:@@netquery.scope.Global:Internet`],
  [String(IPScope.LocalMulticast), $localize`:@@netquery.scope.LocalMulticast:LAN Multicast`],
  [String(IPScope.GlobalMulitcast), $localize`:@@netquery.scope.GlobalMulitcast:Internet Multicast`],
]);

const verdictLabels = new Map<string, string>([
  [String(Verdict.Undecided), $localize`:@@netquery.verdict.Undecided:Undecided`],
  [String(Verdict.Undeterminable), $localize`:@@netquery.verdict.Undeterminable:Undeterminable`],
  [String(Verdict.Accept), $localize`:@@netquery.verdict.Accept:Accept`],
  [String(Verdict.Block), $localize`:@@netquery.verdict.Block:Block`],
  [String(Verdict.Drop), $localize`:@@netquery.verdict.Drop:Drop`],
  [String(Verdict.RerouteToNs), $localize`:@@netquery.verdict.RerouteToNs:RerouteToNs`],
  [String(Verdict.RerouteToTunnel), $localize`:@@netquery.verdict.RerouteToTunnel:RerouteToTunnel`],
  [String(Verdict.Failed), $localize`:@@netquery.verdict.Failed:Failed`],
  [String(Verdict.RerouteToSplitTun), $localize`:@@netquery.verdict.RerouteToSplitTun:RerouteToSplitTun`],
]);

// ponytail: exact field/value labels only; never feed display text back into a query.
export function connectionValueLabel(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return $localize`:@@netquery.notAvailable:N/A`;
  }
  if (field === 'scope') {
    return scopeLabels.get(String(value)) ?? String(value);
  }
  if (field === 'verdict') {
    return verdictLabels.get(String(value)) ?? String(value);
  }
  if (typeof value === 'boolean' && ['allowed', 'active', 'tunneled', 'encrypted', 'internal'].includes(field)) {
    return value ? $localize`:@@netquery.yes:Yes` : $localize`:@@netquery.no:No`;
  }
  if (field === 'direction' && value === 'inbound') return $localize`:@@netquery.direction.inbound:Inbound`;
  if (field === 'direction' && value === 'outbound') return $localize`:@@netquery.direction.outbound:Outbound`;
  if (field === 'type' && value === 'dns') return $localize`:@@netquery.type.dns:DNS Request`;
  if (field === 'type' && value === 'ip') return $localize`:@@netquery.type.ip:IP Connection`;
  return String(value);
}

export function isMatcher(v: any | Matcher): v is Matcher {
  return typeof v === 'object' && ('$eq' in v || '$ne' in v || '$like' in v || '$in' in v || '$notin' in v);
}

export function mergeConditions(cond1: Condition, cond2: Condition): Condition {
  const result: Condition = {};

  objKeys(cond1).forEach(key => {
    let val = cond1[key];
    if (Array.isArray(val)) {
      result[key] = val;
    } else {
      result[key] = [val];
    }
  })

  objKeys(cond2).forEach(key => {
    let val = cond2[key];
    if (!Array.isArray(val)) {
      val = [val]
    }

    if (!(key in result)) {
      result[key] = val;
    } else {
      result[key] = [
        ...(result[key] as any), // this must be an array here
        ...val,
      ]
    }
  })


  return result;
}
