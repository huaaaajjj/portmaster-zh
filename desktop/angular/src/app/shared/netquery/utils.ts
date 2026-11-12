import { Condition, IPScope, Matcher, Reason, Verdict } from "@safing/portmaster-api";
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

const reasonLabels = new Map<string, string>([
  ["unknown process or profile", $localize`:@@netquery.reason.unknownProcess:unknown process or profile`],
  ["allowing dns request", $localize`:@@netquery.reason.allowDNS:allowing dns request`],
  ["allowed by default action", $localize`:@@netquery.reason.defaultAllow:allowed by default action`],
  ["blocked by default action", $localize`:@@netquery.reason.defaultBlock:blocked by default action`],
  ["connection by Portmaster", $localize`:@@netquery.reason.portmaster:connection by Portmaster`],
  ["inbound connections blocked", $localize`:@@netquery.reason.inboundBlocked:inbound connections blocked`],
  ["P2P assistive infrastructure blocked based on filter list", $localize`:@@netquery.reason.p2pList:P2P assistive infrastructure blocked based on filter list`],
  ["P2P assistive infrastructure blocked based on port", $localize`:@@netquery.reason.p2pPort:P2P assistive infrastructure blocked based on port`],
  ["direct connections (P2P) blocked", $localize`:@@netquery.reason.p2pDirect:direct connections (P2P) blocked`],
  ["special grant for connectivity domain during network bootstrap", $localize`:@@netquery.reason.bootstrap:special grant for connectivity domain during network bootstrap`],
  ["Internet and LAN access blocked", $localize`:@@netquery.reason.internetLAN:Internet and LAN access blocked`],
  ["Internet access blocked", $localize`:@@netquery.reason.internet:Internet access blocked`],
  ["LAN access blocked", $localize`:@@netquery.reason.lan:LAN access blocked`],
  ["Localhost access blocked", $localize`:@@netquery.reason.localhost:Localhost access blocked`],
  ["invalid IP", $localize`:@@netquery.reason.invalidIP:invalid IP`],
  ["DNS global/private split-view violation", $localize`:@@netquery.reason.dnsSplit:DNS global/private split-view violation`],
  ["DNS response only contained to-be-blocked IPs", $localize`:@@netquery.reason.dnsBlockedIPs:DNS response only contained to-be-blocked IPs`],
  ["DNS server horizon violation: global DNS server returned local IP address", $localize`:@@netquery.reason.dnsGlobalHorizon:DNS server horizon violation: global DNS server returned local IP address`],
  ["DNS server horizon violation: LAN DNS server returned localhost IP address", $localize`:@@netquery.reason.dnsLANHorizon:DNS server horizon violation: LAN DNS server returned localhost IP address`],
  ["possible DGA domain commonly used by malware", $localize`:@@netquery.reason.dga:possible DGA domain commonly used by malware`],
  ["possible data tunnel for covert communication and protection bypassing", $localize`:@@netquery.reason.dataTunnel:possible data tunnel for covert communication and protection bypassing`],
  ["IP address is in the custom filter list", $localize`:@@netquery.reason.customIP:IP address is in the custom filter list`],
  ["AS is in the custom filter list", $localize`:@@netquery.reason.customAS:AS is in the custom filter list`],
  ["country is in the custom filter list", $localize`:@@netquery.reason.customCountry:country is in the custom filter list`],
  ["fast-tracked", $localize`:@@netquery.reason.fastTracked:fast-tracked`],
  ["split tunnel connection proxied by Portmaster", $localize`:@@netquery.reason.splitProxy:split tunnel connection proxied by Portmaster`],
  ["redirecting rogue dns query", $localize`:@@netquery.reason.rogueDNS:redirecting rogue dns query`],
  ["privacy filter disabled", $localize`:@@netquery.reason.disabled:privacy filter disabled`],
  ["none DNS data on DNS port", $localize`:@@netquery.reason.notDNS:none DNS data on DNS port`],
  ["allowed via prompt", $localize`:@@netquery.reason.promptAllow:allowed via prompt`],
  ["blocked via prompt", $localize`:@@netquery.reason.promptBlock:blocked via prompt`],
  ["prompting canceled, waiting for new decision", $localize`:@@netquery.reason.promptCanceled:prompting canceled, waiting for new decision`],
  ["prompting in progress, please respond to prompt", $localize`:@@netquery.reason.promptPending:prompting in progress, please respond to prompt`],
  ["shutting down", $localize`:@@netquery.reason.shutdown:shutting down`],
  ["no profile set", $localize`:@@netquery.reason.noProfile:no profile set`],
  ["failed to check Split Tunnel rules", $localize`:@@netquery.reason.splitRules:failed to check Split Tunnel rules`],
  ["failed to check SPN rules", $localize`:@@netquery.reason.spnRules:failed to check SPN rules`],
  ["SPN not ready for tunneling", $localize`:@@netquery.reason.spnNotReady:SPN not ready for tunneling`],
  ["bypass prevention: blocked canary domain to prevent enabling of DNS-over-HTTPs", $localize`:@@netquery.reason.bypassCanary:bypass prevention: blocked canary domain to prevent enabling of DNS-over-HTTPs`],
  ["bypass prevention: blocked DNS query, manual dns setup required", $localize`:@@netquery.reason.bypassDNS:bypass prevention: blocked DNS query, manual dns setup required`],
  ["bypass prevention: blocked rogue connection to DNS resolver", $localize`:@@netquery.reason.bypassResolver:bypass prevention: blocked rogue connection to DNS resolver`],
]);

const ruleDescriptions = new Map<string, string>([
  ["matches", $localize`:@@netquery.reason.ruleDescription.matches:matches`],
  ["ASN data not available to match", $localize`:@@netquery.reason.ruleDescription.asnMissing:ASN data not available to match`],
  ["IP is part of AS", $localize`:@@netquery.reason.ruleDescription.as:IP is part of AS`],
  ["country data not available to match", $localize`:@@netquery.reason.ruleDescription.countryMissing:country data not available to match`],
  ["IP is located in", $localize`:@@netquery.reason.ruleDescription.location:IP is located in`],
  ["domain matches", $localize`:@@netquery.reason.ruleDescription.domain:domain matches`],
  ["IP matches", $localize`:@@netquery.reason.ruleDescription.ip:IP matches`],
  ["IP is in", $localize`:@@netquery.reason.ruleDescription.range:IP is in`],
  ["filterlist contains", $localize`:@@netquery.reason.ruleDescription.list:filterlist contains`],
  ["scope matches", $localize`:@@netquery.reason.ruleDescription.scope:scope matches`],
]);

// ponytail: exact backend wording and rule context only; unknown/ambiguous messages stay raw.
export function localizeConnectionReason(reason: Reason | null | undefined): string {
  const message = reason?.Msg;
  if (typeof message !== 'string') return '';
  const fixed = reasonLabels.get(message);
  if (fixed !== undefined) return fixed;

  const context = reason?.Context;
  if (context && !Array.isArray(context) && typeof context.Filter === 'string'
    && typeof context.Permitted === 'boolean'
    && context.Filter.startsWith(context.Permitted ? '+ ' : '- ') && context.Filter.length > 2) {
    const rule = context.Filter.slice(2);
    const prefix = context.Permitted ? 'allowed by rule: ' : 'denied by rule: ';
    for (const [description, label] of ruleDescriptions) {
      if (message === prefix + description + ' ' + rule) {
        return context.Permitted ? $localize`:@@netquery.reason.ruleAllow:allowed by rule: ${label}:DESCRIPTION: ${rule}:RULE:` : $localize`:@@netquery.reason.ruleDeny:denied by rule: ${label}:DESCRIPTION: ${rule}:RULE:`;
      }
    }
  }
  if (message.startsWith('failed to request tunneling: ')) {
    const error = message.slice('failed to request tunneling: '.length);
    if (error) return $localize`:@@netquery.reason.tunnelError:failed to request tunneling: ${error}:ERROR:`;
  }
  if (message.startsWith('failed to request split-tunneling: ')) {
    const error = message.slice('failed to request split-tunneling: '.length);
    if (error) return $localize`:@@netquery.reason.splitError:failed to request split-tunneling: ${error}:ERROR:`;
  }
  let match = message.match(/^response to multi\/broadcast query to ([^/\s]+)\/([^\s]+)$/);
  if (match && match[0] === message) {
    const protocol = match[1], address = match[2];
    return $localize`:@@netquery.reason.multicast:response to multi/broadcast query to ${protocol}:PROTOCOL:/${address}:ADDRESS:`;
  }
  match = message.match(/^auto allowed: domain is related to process: ([\s\S]+) is related to ([\s\S]+)$/);
  if (match && match[0] === message && message.split(' is related to ').length === 3) {
    const domain = match[1], process = match[2];
    return $localize`:@@netquery.reason.autoRelation:auto allowed: domain is related to process: ${domain}:DOMAIN: is related to ${process}:PROCESS:`;
  }
  match = message.match(/^domain ([^\s]+) matches ([^\s]+) in custom filter list$/);
  if (match && match[0] === message && message.split(' matches ').length === 2
    && reason?.OptionKey === 'filter/customListFile') {
    const domain = match[1], entry = match[2];
    return $localize`:@@netquery.reason.customDomain:domain ${domain}:DOMAIN: matches ${entry}:ENTRY: in custom filter list`;
  }
  match = message.match(/^domain alias \(CNAME\) ([^\s]+) matches ([^\s]+) in custom filter list$/);
  if (match && match[0] === message && message.split(' matches ').length === 2
    && reason?.OptionKey === 'filter/customListFile') {
    const domain = match[1], entry = match[2];
    return $localize`:@@netquery.reason.customCNAME:domain alias (CNAME) ${domain}:DOMAIN: matches ${entry}:ENTRY: in custom filter list`;
  }
  return message;
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
