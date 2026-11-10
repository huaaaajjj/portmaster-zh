import { Pipe, PipeTransform } from '@angular/core';

// ponytail: exact known display text only; unknown server text passes through unchanged.
// Never apply this to configuration keys, values, rules, URLs or action identifiers.
const messages = new Map<string, string>([
  ["Critical", $localize`:@@settings.metadata.427dd2969bd1:Critical`],
  ["The critical level only logs errors that lead to a partial, but imminent failure.", $localize`:@@settings.metadata.f8c805e15c0a:The critical level only logs errors that lead to a partial, but imminent failure.`],
  ["Error", $localize`:@@settings.metadata.54a0e8c17ebb:Error`],
  ["The error level logs errors that potentially break functionality. Everything logged by the critical level is included here too.", $localize`:@@settings.metadata.ec2ca47c5e8e:The error level logs errors that potentially break functionality. Everything logged by the critical level is included here too.`],
  ["Warning", $localize`:@@settings.metadata.e981ddae45d8:Warning`],
  ["The warning level logs minor errors and worse. Everything logged by the error level is included here too.", $localize`:@@settings.metadata.45114d78c01a:The warning level logs minor errors and worse. Everything logged by the error level is included here too.`],
  ["Info", $localize`:@@settings.metadata.170322a32f3c:Info`],
  ["The info level logs the main events that are going on and are interesting to the user. Everything logged by the warning level is included here too.", $localize`:@@settings.metadata.f8964cfe421b:The info level logs the main events that are going on and are interesting to the user. Everything logged by the warning level is included here too.`],
  ["Debug", $localize`:@@settings.metadata.1a03bd2fd107:Debug`],
  ["The debug level logs some additional debugging details. Everything logged by the info level is included here too.", $localize`:@@settings.metadata.ba483ad7798c:The debug level logs some additional debugging details. Everything logged by the info level is included here too.`],
  ["Trace", $localize`:@@settings.metadata.7e14c3d7dd12:Trace`],
  ["The trace level logs loads of detailed information as well as operation and request traces. Everything logged by the debug level is included here too.", $localize`:@@settings.metadata.51c4dd0fc5aa:The trace level logs loads of detailed information as well as operation and request traces. Everything logged by the debug level is included here too.`],
  ["Simple Interface", $localize`:@@settings.metadata.3684b5231f62:Simple Interface`],
  ["Hide complex settings and information.", $localize`:@@settings.metadata.c1601565c13b:Hide complex settings and information.`],
  ["Advanced Interface", $localize`:@@settings.metadata.6589b4a7510a:Advanced Interface`],
  ["Show technical details.", $localize`:@@settings.metadata.f5596ff60785:Show technical details.`],
  ["Developer Interface", $localize`:@@settings.metadata.74243c182eb4:Developer Interface`],
  ["Developer mode. Please be careful!", $localize`:@@settings.metadata.5f160df5847b:Developer mode. Please be careful!`],
  ["Stable", $localize`:@@settings.metadata.90ee305714d7:Stable`],
  ["Production releases.", $localize`:@@settings.metadata.f4c226193eca:Production releases.`],
  ["Beta", $localize`:@@settings.metadata.703390318bd5:Beta`],
  ["Production releases for testing new features that may break and cause interruption.", $localize`:@@settings.metadata.c505331dfa04:Production releases for testing new features that may break and cause interruption.`],
  ["Experimental", $localize`:@@settings.metadata.3dc9f569422d:Experimental`],
  ["Only show stable features.", $localize`:@@settings.metadata.8721db65ef82:Only show stable features.`],
  ["Show stable and beta features.", $localize`:@@settings.metadata.72b061bb7b47:Show stable and beta features.`],
  ["Show all features", $localize`:@@settings.metadata.1cc52bbf28ec:Show all features`],
  ["Support", $localize`:@@settings.metadata.be91940b79f4:Support`],
  ["Support releases or version changes for troubleshooting. Only use temporarily and when instructed.", $localize`:@@settings.metadata.1cc503079127:Support releases or version changes for troubleshooting. Only use temporarily and when instructed.`],
  ["Staging", $localize`:@@settings.metadata.a8e7ac92a116:Staging`],
  ["Dangerous development releases for testing random things and experimenting. Only use temporarily and when instructed.", $localize`:@@settings.metadata.730c9a808942:Dangerous development releases for testing random things and experimenting. Only use temporarily and when instructed.`],
  ["Loading...", $localize`:@@settings.metadata.47d2a515ef2f:Loading...`],
  ["Allow", $localize`:@@settings.metadata.e213c161d5ce:Allow`],
  ["Allow all connections", $localize`:@@settings.metadata.1fb9a06c9b88:Allow all connections`],
  ["Block", $localize`:@@settings.metadata.211d0bb8cf4f:Block`],
  ["Block all connections", $localize`:@@settings.metadata.4062aae71387:Block all connections`],
  ["Prompt", $localize`:@@settings.metadata.5c39123805ff:Prompt`],
  ["Prompt for decisions", $localize`:@@settings.metadata.0390eced8e54:Prompt for decisions`],
  ["Exclude", $localize`:@@settings.metadata.5b76f62e1ba0:Exclude`],
  ["Allow SSH", $localize`:@@settings.metadata.41b501730fe2:Allow SSH`],
  ["Allow HTTP/s", $localize`:@@settings.metadata.ac7440faf1ad:Allow HTTP/s`],
  ["Allow RDP", $localize`:@@settings.metadata.0600c0273b96:Allow RDP`],
  ["Allow all from LAN", $localize`:@@settings.metadata.d783f3990013:Allow all from LAN`],
  ["Allow all from Internet", $localize`:@@settings.metadata.8ce19179fc20:Allow all from Internet`],
  ["Block everything else", $localize`:@@settings.metadata.2aea1142a700:Block everything else`],
  ["Plain VPN Mode", $localize`:@@settings.metadata.bdcc0dbbc942:Plain VPN Mode`],
  ["Always connect to the destination directly from the Home Hub. Only provides very basic privacy, as the Home Hub both knows where you are coming from and where you are connecting to.", $localize`:@@settings.metadata.1857ac3470b3:Always connect to the destination directly from the Home Hub. Only provides very basic privacy, as the Home Hub both knows where you are coming from and where you are connecting to.`],
  ["Speed Focused", $localize`:@@settings.metadata.0a54b237d0f8:Speed Focused`],
  ["Optimize routes with a minimum of one hop. Provides good speeds. This will often use the Home Hub to connect to destinations near you, but will use more hops to far away destinations for better privacy over long distances.", $localize`:@@settings.metadata.a20750710bfa:Optimize routes with a minimum of one hop. Provides good speeds. This will often use the Home Hub to connect to destinations near you, but will use more hops to far away destinations for better privacy over long distances.`],
  ["Balanced", $localize`:@@settings.metadata.5386ea5db81c:Balanced`],
  ["Optimize routes with a minimum of two hops. Provides good privacy as well as good speeds. No single node knows where you are coming from *and* where you are connecting to.", $localize`:@@settings.metadata.c8a31c8767b4:Optimize routes with a minimum of two hops. Provides good privacy as well as good speeds. No single node knows where you are coming from *and* where you are connecting to.`],
  ["Privacy Focused", $localize`:@@settings.metadata.ef61d89e9c04:Privacy Focused`],
  ["Optimize routes with a minimum of three hops. Provides very good privacy. No single node knows where you are coming from *and* where you are connecting to - with an additional hop just to be sure.", $localize`:@@settings.metadata.f2883e40ac43:Optimize routes with a minimum of three hops. Provides very good privacy. No single node knows where you are coming from *and* where you are connecting to - with an additional hop just to be sure.`],
  ["Set Cloudflare (with Malware Filter)", $localize`:@@settings.metadata.3ebccbd8c980:Set Cloudflare (with Malware Filter)`],
  ["Set Quad9", $localize`:@@settings.metadata.011d4224950e:Set Quad9`],
  ["Set AdGuard", $localize`:@@settings.metadata.d8d39a28d427:Set AdGuard`],
  ["Set Foundation for Applied Privacy", $localize`:@@settings.metadata.6705e2b5bb40:Set Foundation for Applied Privacy`],
  ["Add Cloudflare (as fallback)", $localize`:@@settings.metadata.4c4e9f4ed073:Add Cloudflare (as fallback)`],
  ["Core", $localize`:@@settings.metadata.70ea1983c983:Core`],
  ["Base Structure and System Integration", $localize`:@@settings.metadata.6e7e0e8c0ef8:Base Structure and System Integration`],
  ["Secure DNS", $localize`:@@settings.metadata.2a1fad944698:Secure DNS`],
  ["DNS resolver with scoping and DNS-over-TLS", $localize`:@@settings.metadata.20eaf57e5d86:DNS resolver with scoping and DNS-over-TLS`],
  ["Privacy Filter", $localize`:@@settings.metadata.225aca0482cd:Privacy Filter`],
  ["DNS and Network Filter", $localize`:@@settings.metadata.65728f8011a9:DNS and Network Filter`],
  ["Network History", $localize`:@@settings.metadata.2dfd55b61192:Network History`],
  ["Keep Network History Data", $localize`:@@settings.metadata.3a5c4460bd57:Keep Network History Data`],
  ["Safing Privacy Network", $localize`:@@settings.metadata.15062ac5938a:Safing Privacy Network`],
  ["Split Tunnel", $localize`:@@settings.metadata.7adca15ece68:Split Tunnel`],
  ["Route traffic through specified interface to bypass default routing", $localize`:@@settings.metadata.7648f1c03f8a:Route traffic through specified interface to bypass default routing`],
  ["Advanced", $localize`:@@settings.metadata.9f088dbebd6c:Advanced`],
  ["Connection Types", $localize`:@@settings.metadata.73d0d39e5701:Connection Types`],
  ["DNS Filtering", $localize`:@@settings.metadata.ce1fd4106539:DNS Filtering`],
  ["Days", $localize`:@@settings.metadata.e08c0aa8f558:Days`],
  ["Development", $localize`:@@settings.metadata.21b6a798321a:Development`],
  ["General", $localize`:@@settings.metadata.c910d474dcd7:General`],
  ["Metrics", $localize`:@@settings.metadata.a58da793c725:Metrics`],
  ["Network Scope", $localize`:@@settings.metadata.647c3bbc65b0:Network Scope`],
  ["Resolving", $localize`:@@settings.metadata.3287a034a4b7:Resolving`],
  ["Routing", $localize`:@@settings.metadata.bcba696f3eb1:Routing`],
  ["Rules", $localize`:@@settings.metadata.4228aeb07c41:Rules`],
  ["Servers", $localize`:@@settings.metadata.68d7beb6df59:Servers`],
  ["Updates", $localize`:@@settings.metadata.22e2bada8f1c:Updates`],
  ["User Interface", $localize`:@@settings.metadata.480a0f132f51:User Interface`],
  ["seconds", $localize`:@@settings.metadata.59f006d63bd0:seconds`],
  ["other", $localize`:@@settings.metadata.d9298a10d1b0:other`],
  ["API Listen Address", $localize`:@@settings.metadata.9ba1bffedda7:API Listen Address`],
  ["Defines the IP address and port on which the internal API listens.", $localize`:@@settings.metadata.8df1d780a7f5:Defines the IP address and port on which the internal API listens.`],
  ["API Keys", $localize`:@@settings.metadata.c08f17eb9e11:API Keys`],
  ["Define API keys for privileged access to the API. Every entry is a separate API key with respective permissions. Format is `<key>?read=<perm>&write=<perm>`. Permissions are `anyone`, `user` and `admin`, and may be omitted.", $localize`:@@settings.metadata.2c3d2b050483:Define API keys for privileged access to the API. Every entry is a separate API key with respective permissions. Format is \`<key>?read=<perm>&write=<perm>\`. Permissions are \`anyone\`, \`user\` and \`admin\`, and may be omitted.`],
  ["Log Level", $localize`:@@settings.metadata.12fe4737438f:Log Level`],
  ["Configure the logging level.", $localize`:@@settings.metadata.9ff6cd3d48df:Configure the logging level.`],
  ["Development Mode", $localize`:@@settings.metadata.cf175c1f6951:Development Mode`],
  ["In Development Mode, security restrictions are lifted/softened to enable unrestricted access for debugging and testing purposes.", $localize`:@@settings.metadata.dc6f975f8cc1:In Development Mode, security restrictions are lifted/softened to enable unrestricted access for debugging and testing purposes.`],
  ["UI Mode", $localize`:@@settings.metadata.906bd5cd4832:UI Mode`],
  ["Control the default amount of settings and information shown. Hidden settings are still in effect. Can be changed temporarily in the top right corner.", $localize`:@@settings.metadata.e147bc331908:Control the default amount of settings and information shown. Hidden settings are still in effect. Can be changed temporarily in the top right corner.`],
  ["Feature Stability", $localize`:@@settings.metadata.9a68dae3f38c:Feature Stability`],
  ["May break things. Decide if you want to experiment with unstable features. \"Beta\" has been tested roughly by the Safing team while \"Experimental\" is really raw. When \"Beta\" or \"Experimental\" are disabled, their settings use the default again.", $localize`:@@settings.metadata.2ff53cca9e79:May break things. Decide if you want to experiment with unstable features. "Beta" has been tested roughly by the Safing team while "Experimental" is really raw. When "Beta" or "Experimental" are disabled, their settings use the default again.`],
  ["Metrics Instance Name", $localize`:@@settings.metadata.e5c26693cedc:Metrics Instance Name`],
  ["Define the prometheus instance label for all exported metrics. Please note that changing the metrics instance name will reset persisted metrics.", $localize`:@@settings.metadata.052156eecd2c:Define the prometheus instance label for all exported metrics. Please note that changing the metrics instance name will reset persisted metrics.`],
  ["Metrics Comment Label", $localize`:@@settings.metadata.ce78b37cecaf:Metrics Comment Label`],
  ["Define a metrics comment label, which is added to the info metric.", $localize`:@@settings.metadata.a6533ba98d41:Define a metrics comment label, which is added to the info metric.`],
  ["Push Prometheus Metrics", $localize`:@@settings.metadata.40627b6483ec:Push Prometheus Metrics`],
  ["Push metrics to this URL in the prometheus format.", $localize`:@@settings.metadata.f54eeb881cad:Push metrics to this URL in the prometheus format.`],
  ["Desktop Notifications", $localize`:@@settings.metadata.5a0ae97edb8b:Desktop Notifications`],
  ["In addition to showing notifications in the Portmaster App, also send them to the Desktop. This requires the Portmaster Notifier to be running.", $localize`:@@settings.metadata.977d3dc96bfe:In addition to showing notifications in the Portmaster App, also send them to the Desktop. This requires the Portmaster Notifier to be running.`],
  ["Network Service", $localize`:@@settings.metadata.f8f9564aea44:Network Service`],
  ["Use the Portmaster as a network service, where applicable. You will have to take care of lots of network setup yourself in order to run this properly and securely.", $localize`:@@settings.metadata.637f2f546107:Use the Portmaster as a network service, where applicable. You will have to take care of lots of network setup yourself in order to run this properly and securely.`],
  ["Time and Date Format", $localize`:@@settings.metadata.3b39a6164c6c:Time and Date Format`],
  ["Configures the time and date format for the user interface. Selection is an example and correct formatting in the UI is a continual work in progress.", $localize`:@@settings.metadata.fb9844c54c37:Configures the time and date format for the user interface. Selection is an example and correct formatting in the UI is a continual work in progress.`],
  ["Release Channel", $localize`:@@settings.metadata.212de218cee4:Release Channel`],
  ["Use \"Stable\" for the best experience. The \"Beta\" channel will have the newest features and fixes, but may also break and cause interruption. Use others only temporarily and when instructed.", $localize`:@@settings.metadata.81db78bad0f8:Use "Stable" for the best experience. The "Beta" channel will have the newest features and fixes, but may also break and cause interruption. Use others only temporarily and when instructed.`],
  ["Automatic Software Updates", $localize`:@@settings.metadata.0f9f138ead8f:Automatic Software Updates`],
  ["Automatically check for and download software updates. This does not include intelligence data updates.", $localize`:@@settings.metadata.fc60b43471e5:Automatically check for and download software updates. This does not include intelligence data updates.`],
  ["Automatic Intelligence Data Updates", $localize`:@@settings.metadata.e568eb294e1c:Automatic Intelligence Data Updates`],
  ["Automatically check for and download intelligence data updates. This includes filter lists, geo-ip data, and more. Does not include software updates.", $localize`:@@settings.metadata.f76f9f1e3f73:Automatically check for and download intelligence data updates. This includes filter lists, geo-ip data, and more. Does not include software updates.`],
  ["Enable Privacy Filter", $localize`:@@settings.metadata.523ff1543123:Enable Privacy Filter`],
  ["Enable the Privacy Filter. If turned off, all privacy filter protections are fully disabled on this device. Not meant to be disabled in production - only turn off for testing.", $localize`:@@settings.metadata.1164d44488ed:Enable the Privacy Filter. If turned off, all privacy filter protections are fully disabled on this device. Not meant to be disabled in production - only turn off for testing.`],
  ["Permanent Verdicts", $localize`:@@settings.metadata.d2d81c9ca696:Permanent Verdicts`],
  ["The Portmaster's system integration intercepts every single packet. Usually the first packet is enough for the Portmaster to set the verdict for a connection - ie. to allow or deny it. Making these verdicts permanent means that the Portmaster will tell the system integration that is does not want to see any more packets of that single connection. This brings a major performance increase.", $localize`:@@settings.metadata.2a3b8725e244:The Portmaster's system integration intercepts every single packet. Usually the first packet is enough for the Portmaster to set the verdict for a connection - ie. to allow or deny it. Making these verdicts permanent means that the Portmaster will tell the system integration that is does not want to see any more packets of that single connection. This brings a major performance increase.`],
  ["Seamless DNS Integration", $localize`:@@settings.metadata.205a312b908e:Seamless DNS Integration`],
  ["Intercept and redirect astray DNS queries to the Portmaster's internal DNS server. This enables seamless DNS integration without having to configure the system or other software. However, this may lead to compatibility issues with other software that attempts the same.", $localize`:@@settings.metadata.9518761b76f9:Intercept and redirect astray DNS queries to the Portmaster's internal DNS server. This enables seamless DNS integration without having to configure the system or other software. However, this may lead to compatibility issues with other software that attempts the same.`],
  ["Prompt Desktop Notifications", $localize`:@@settings.metadata.5e24fc1cad75:Prompt Desktop Notifications`],
  ["In addition to showing prompt notifications in the Portmaster App, also send them to the Desktop. This requires the Portmaster Notifier to be running. Requires Desktop Notifications to be enabled.", $localize`:@@settings.metadata.583e5453f197:In addition to showing prompt notifications in the Portmaster App, also send them to the Desktop. This requires the Portmaster Notifier to be running. Requires Desktop Notifications to be enabled.`],
  ["Prompt Timeout", $localize`:@@settings.metadata.a41f3d360537:Prompt Timeout`],
  ["How long the Portmaster will wait for a reply to a prompt notification. Please note that Desktop Notifications might not respect this or have their own limits.", $localize`:@@settings.metadata.1aa32bea6b54:How long the Portmaster will wait for a reply to a prompt notification. Please note that Desktop Notifications might not respect this or have their own limits.`],
  ["Internal DNS Server Listen Address", $localize`:@@settings.metadata.7eee598e266d:Internal DNS Server Listen Address`],
  ["Defines the IP address and port on which the internal DNS Server listens.", $localize`:@@settings.metadata.73796ca8a477:Defines the IP address and port on which the internal DNS Server listens.`],
  ["Process Detection", $localize`:@@settings.metadata.38009c605ef1:Process Detection`],
  ["This option enables the attribution of network traffic to processes. Without it, app settings are effectively disabled.", $localize`:@@settings.metadata.873a656bb06f:This option enables the attribution of network traffic to processes. Without it, app settings are effectively disabled.`],
  ["Default Network Action", $localize`:@@settings.metadata.271321b68f52:Default Network Action`],
  ["The default network action is applied when nothing else allows or blocks a connection. This affects both outgoing and incoming connections. This setting is the weakest of all and is commonly overruled by Force Block settings or Rules.", $localize`:@@settings.metadata.dc636b6ab27e:The default network action is applied when nothing else allows or blocks a connection. This affects both outgoing and incoming connections. This setting is the weakest of all and is commonly overruled by Force Block settings or Rules.`],
  ["Disable Auto Allow", $localize`:@@settings.metadata.4549b84f683d:Disable Auto Allow`],
  ["Auto Allow searches for a relation between an app and the destination of a connection - if there is a correlation, the connection will be allowed.", $localize`:@@settings.metadata.890fbb7f2b41:Auto Allow searches for a relation between an app and the destination of a connection - if there is a correlation, the connection will be allowed.`],
  ["Enable Network History", $localize`:@@settings.metadata.e750e328bdfb:Enable Network History`],
  ["Save connections in a database (on disk) in order to view and search them later. Changes might take a couple minutes to apply to all connections.\n\nIn order to reduce noise optimize performance, internal and device-only (localhost) connections are not saved to history.", $localize`:@@settings.metadata.96834cdcac8d:Save connections in a database (on disk) in order to view and search them later. Changes might take a couple minutes to apply to all connections.

In order to reduce noise optimize performance, internal and device-only (localhost) connections are not saved to history.`],
  ["Keep Network History", $localize`:@@settings.metadata.6419de948ed3:Keep Network History`],
  ["Specify how many days the network history data should be kept. Please keep in mind that more available history data makes reports (coming soon) a lot more useful.\n\t\t\nOlder data is deleted in intervals and cleared from the database continually. If in a hurry, shutdown or restart Portmaster to clear deleted entries immediately.\n\nSet to 0 days to keep network history forever. Depending on your device, this might affect performance.", $localize`:@@settings.metadata.4af8b1b5df5b:Specify how many days the network history data should be kept. Please keep in mind that more available history data makes reports (coming soon) a lot more useful.
		
Older data is deleted in intervals and cleared from the database continually. If in a hurry, shutdown or restart Portmaster to clear deleted entries immediately.

Set to 0 days to keep network history forever. Depending on your device, this might affect performance.`],
  ["Outgoing Rules", $localize`:@@settings.metadata.5d5b71baa887:Outgoing Rules`],
  ["Rules that apply to outgoing network connections. Cannot overrule Network Scopes and Connection Types (see above).", $localize`:@@settings.metadata.6015de61df23:Rules that apply to outgoing network connections. Cannot overrule Network Scopes and Connection Types (see above).`],
  ["Incoming Rules", $localize`:@@settings.metadata.5eb4f11a51fb:Incoming Rules`],
  ["Rules that apply to incoming network connections. Cannot overrule Network Scopes and Connection Types (see above).", $localize`:@@settings.metadata.9cf23956c8ad:Rules that apply to incoming network connections. Cannot overrule Network Scopes and Connection Types (see above).`],
  ["Filter Lists", $localize`:@@settings.metadata.a2fee95cc4f0:Filter Lists`],
  ["Block connections that match enabled filter lists.", $localize`:@@settings.metadata.0bb223cd5294:Block connections that match enabled filter lists.`],
  ["Block Domain Aliases", $localize`:@@settings.metadata.957ad0863ba3:Block Domain Aliases`],
  ["Block a domain if a resolved CNAME (alias) is blocked by a rule or filter list.", $localize`:@@settings.metadata.84067144e841:Block a domain if a resolved CNAME (alias) is blocked by a rule or filter list.`],
  ["Block Subdomains of Filter List Entries", $localize`:@@settings.metadata.16ccb596a08f:Block Subdomains of Filter List Entries`],
  ["Additionally block all subdomains of entries in selected filter lists.", $localize`:@@settings.metadata.78d6ec31b806:Additionally block all subdomains of entries in selected filter lists.`],
  ["Force Block Device-Local Connections", $localize`:@@settings.metadata.b51e99ff7601:Force Block Device-Local Connections`],
  ["Force Block all internal connections on your own device, ie. localhost. Is stronger than Rules (see below).", $localize`:@@settings.metadata.db8b39164ad1:Force Block all internal connections on your own device, ie. localhost. Is stronger than Rules (see below).`],
  ["Force Block LAN", $localize`:@@settings.metadata.fc9f0eb471bd:Force Block LAN`],
  ["Force Block all connections from and to the Local Area Network. Is stronger than Rules (see below).", $localize`:@@settings.metadata.a9c674e2b9a7:Force Block all connections from and to the Local Area Network. Is stronger than Rules (see below).`],
  ["Force Block Internet Access", $localize`:@@settings.metadata.c03ce311d968:Force Block Internet Access`],
  ["Force Block connections from and to the Internet. Is stronger than Rules (see below).", $localize`:@@settings.metadata.ff8b5593103c:Force Block connections from and to the Internet. Is stronger than Rules (see below).`],
  ["Force Block P2P/Direct Connections", $localize`:@@settings.metadata.025708b5a2db:Force Block P2P/Direct Connections`],
  ["These are connections that are established directly to an IP address or peer on the Internet without resolving a domain name via DNS first. Is stronger than Rules (see below).", $localize`:@@settings.metadata.030f09c62bc6:These are connections that are established directly to an IP address or peer on the Internet without resolving a domain name via DNS first. Is stronger than Rules (see below).`],
  ["Force Block Incoming Connections", $localize`:@@settings.metadata.23b2c51484f1:Force Block Incoming Connections`],
  ["Connections initiated towards your device from the LAN or Internet. This will usually only be the case if you are running a network service or are using peer to peer software. Is stronger than Rules (see below).", $localize`:@@settings.metadata.da8dada3a479:Connections initiated towards your device from the LAN or Internet. This will usually only be the case if you are running a network service or are using peer to peer software. Is stronger than Rules (see below).`],
  ["Enforce Global/Private Split-View", $localize`:@@settings.metadata.551f69df5bd9:Enforce Global/Private Split-View`],
  ["Reject private IP addresses (RFC1918 et al.) from public DNS responses. If the system resolver is in use, the resulting connection will be blocked instead of the DNS request.", $localize`:@@settings.metadata.973e04c5fdbb:Reject private IP addresses (RFC1918 et al.) from public DNS responses. If the system resolver is in use, the resulting connection will be blocked instead of the DNS request.`],
  ["Reject Blocked IPs", $localize`:@@settings.metadata.a9f30e3936dc:Reject Blocked IPs`],
  ["Reject blocked IP addresses directly from the DNS response instead of handing them over to the app and blocking a resulting connection. This settings does not affect privacy and only takes effect when the system resolver is not in use.", $localize`:@@settings.metadata.be124d69e12b:Reject blocked IP addresses directly from the DNS response instead of handing them over to the app and blocking a resulting connection. This settings does not affect privacy and only takes effect when the system resolver is not in use.`],
  ["Enable Domain Heuristics", $localize`:@@settings.metadata.b830330b8338:Enable Domain Heuristics`],
  ["Checks for suspicious domain names and blocks them. This option currently targets domain names generated by malware and DNS data exfiltration channels.", $localize`:@@settings.metadata.0123d01f0308:Checks for suspicious domain names and blocks them. This option currently targets domain names generated by malware and DNS data exfiltration channels.`],
  ["Block Secure DNS Bypassing", $localize`:@@settings.metadata.b87cac317178:Block Secure DNS Bypassing`],
  ["Prevent apps from bypassing Portmaster's Secure DNS resolver.\nIf disabled, Portmaster might have reduced information to correctly enforce rules and filter lists.\nImportant: Portmaster's firewall itself cannot be bypassed.\n\nCurrent Features:  \n- Disable Firefox' internal DNS-over-HTTPs resolver\n- Block direct access to public DNS resolvers\n\nPlease note that DNS bypass attempts might be additionally blocked in the System DNS Client App.", $localize`:@@settings.metadata.ffd4fd10c81c:Prevent apps from bypassing Portmaster's Secure DNS resolver.
If disabled, Portmaster might have reduced information to correctly enforce rules and filter lists.
Important: Portmaster's firewall itself cannot be bypassed.

Current Features:  
- Disable Firefox' internal DNS-over-HTTPs resolver
- Block direct access to public DNS resolvers

Please note that DNS bypass attempts might be additionally blocked in the System DNS Client App.`],
  ["Use SPN", $localize`:@@settings.metadata.8fbb35eb4e4b:Use SPN`],
  ["Protect network traffic with the Safing Privacy Network. If the SPN is not available or the connection is interrupted, network traffic will be blocked.", $localize`:@@settings.metadata.84686f3245f3:Protect network traffic with the Safing Privacy Network. If the SPN is not available or the connection is interrupted, network traffic will be blocked.`],
  ["SPN Rules", $localize`:@@settings.metadata.eefe45146630:SPN Rules`],
  ["Customize rules which connections should or should not be routed through the SPN. Only active if \"Use SPN\" is enabled.", $localize`:@@settings.metadata.b9e2d6a854e2:Customize rules which connections should or should not be routed through the SPN. Only active if "Use SPN" is enabled.`],
  ["Transit Node Rules", $localize`:@@settings.metadata.0bd9375ede61:Transit Node Rules`],
  ["Customize which countries should or should not be used as Transit Nodes. Transit Nodes are used to transit the SPN from your Home to your Exit Node.", $localize`:@@settings.metadata.d007d0111589:Customize which countries should or should not be used as Transit Nodes. Transit Nodes are used to transit the SPN from your Home to your Exit Node.`],
  ["Exit Node Rules", $localize`:@@settings.metadata.3cb9ad0ad916:Exit Node Rules`],
  ["Customize which countries should or should not be used for your Exit Nodes. Exit Nodes are used to exit the SPN and establish a connection to your destination.\n\nBy default, the Portmaster tries to choose the node closest to the destination as the Exit Node. This reduces your exposure to the open Internet. Exit Nodes are chosen for every destination separately.", $localize`:@@settings.metadata.f11b6e7eceb8:Customize which countries should or should not be used for your Exit Nodes. Exit Nodes are used to exit the SPN and establish a connection to your destination.

By default, the Portmaster tries to choose the node closest to the destination as the Exit Node. This reduces your exposure to the open Internet. Exit Nodes are chosen for every destination separately.`],
  ["Select SPN Routing Algorithm", $localize`:@@settings.metadata.811be2941563:Select SPN Routing Algorithm`],
  ["Select the routing algorithm for your connections through the SPN. Configure your preferred balance between speed and privacy. Portmaster may automatically upgrade the routing algorithm if necessary to protect your privacy.", $localize`:@@settings.metadata.5b5d28c764c7:Select the routing algorithm for your connections through the SPN. Configure your preferred balance between speed and privacy. Portmaster may automatically upgrade the routing algorithm if necessary to protect your privacy.`],
  ["Use Split Tunnel", $localize`:@@settings.metadata.caf43b1c8201:Use Split Tunnel`],
  ["Route specific traffic through a different network interface, bypassing default system routing (useful for avoiding VPNs for certain apps).\n\nWhen you enable this and the Network Interface option is empty, Portmaster will try to route your traffic through the default physical network interface.\n\nImportant: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.", $localize`:@@settings.metadata.28426957ddf2:Route specific traffic through a different network interface, bypassing default system routing (useful for avoiding VPNs for certain apps).

When you enable this and the Network Interface option is empty, Portmaster will try to route your traffic through the default physical network interface.

Important: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.`],
  ["Network Interface", $localize`:@@settings.metadata.82cd523f4cac:Network Interface`],
  ["Specify the network interface to route Split Tunnel traffic through. You can define it by:\n- Interface name: \"Ethernet\", \"Wi-Fi\", \"wlan0\", etc.\n- Interface IP address: \"192.168.1.1\", \"10.0.0.1\", etc.\n- Interface MAC address: \"00:1A:2B:3C:4D:5E\", \"01:23:45:67:89:AB\", etc.\n\nLeave empty to let Portmaster detect the physical network interface and ignore virtual VPN interfaces. This helps bypass VPN tunnels. For better reliability, you can specify the interface manually if empty value does not work as expected.\n\nImportant: The connection will be dropped if the network interface cannot be detected or becomes unavailable.\n\nImportant: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.", $localize`:@@settings.metadata.11328e91e409:Specify the network interface to route Split Tunnel traffic through. You can define it by:
- Interface name: "Ethernet", "Wi-Fi", "wlan0", etc.
- Interface IP address: "192.168.1.1", "10.0.0.1", etc.
- Interface MAC address: "00:1A:2B:3C:4D:5E", "01:23:45:67:89:AB", etc.

Leave empty to let Portmaster detect the physical network interface and ignore virtual VPN interfaces. This helps bypass VPN tunnels. For better reliability, you can specify the interface manually if empty value does not work as expected.

Important: The connection will be dropped if the network interface cannot be detected or becomes unavailable.

Important: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.`],
  ["Split Tunnel Rules", $localize`:@@settings.metadata.18f1c0f147f6:Split Tunnel Rules`],
  ["Customize rules which connections should or should not be routed through the Split Tunnel. Only active if \"Use Split Tunnel\" is enabled.\n\t\t\nImportant: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.", $localize`:@@settings.metadata.a81cd854eac0:Customize rules which connections should or should not be routed through the Split Tunnel. Only active if "Use Split Tunnel" is enabled.
		
Important: SPN takes precedence over Split Tunnel. To use Split Tunnel with SPN, configure SPN on a per-app basis or define exceptions that allow Split Tunnel to take effect.`],
  ["DNS Servers", $localize`:@@settings.metadata.f00366461f56:DNS Servers`],
  ["DNS servers to use for resolving DNS requests.", $localize`:@@settings.metadata.8fb42854b45f:DNS servers to use for resolving DNS requests.`],
  ["Retry Failing DNS Servers", $localize`:@@settings.metadata.d03c89691566:Retry Failing DNS Servers`],
  ["Duration in seconds how often failing DNS server should be retried. This is done continuously in the background.", $localize`:@@settings.metadata.7a542654dad5:Duration in seconds how often failing DNS server should be retried. This is done continuously in the background.`],
  ["Ignore System/Network Servers", $localize`:@@settings.metadata.5c1c3c50b77a:Ignore System/Network Servers`],
  ["Ignore DNS servers configured in your system or network. This may break domains from your local network.", $localize`:@@settings.metadata.9e67f1d23a66:Ignore DNS servers configured in your system or network. This may break domains from your local network.`],
  ["Always Use DNS Cache", $localize`:@@settings.metadata.99a065fa071b:Always Use DNS Cache`],
  ["Always use the DNS cache, even if entries have expired. Expired entries are refreshed afterwards in the background. This can improve DNS resolving performance a lot, but may lead to occasional connection errors due to outdated DNS records.", $localize`:@@settings.metadata.81f10eb20eec:Always use the DNS cache, even if entries have expired. Expired entries are refreshed afterwards in the background. This can improve DNS resolving performance a lot, but may lead to occasional connection errors due to outdated DNS records.`],
  ["Ignore Multicast DNS", $localize`:@@settings.metadata.5fa881ee4b8f:Ignore Multicast DNS`],
  ["Do not resolve using Multicast DNS. This may break certain Plug and Play devices and services.", $localize`:@@settings.metadata.0300d76cd083:Do not resolve using Multicast DNS. This may break certain Plug and Play devices and services.`],
  ["Use Secure Protocols Only", $localize`:@@settings.metadata.bad055f6aad9:Use Secure Protocols Only`],
  ["Never resolve using insecure protocols, ie. plain DNS. This may break certain local DNS services, which always use plain DNS.", $localize`:@@settings.metadata.7b51b02f5b26:Never resolve using insecure protocols, ie. plain DNS. This may break certain local DNS services, which always use plain DNS.`],
  ["Block Unofficial TLDs", $localize`:@@settings.metadata.6d668d9ec2bf:Block Unofficial TLDs`],
  ["Split Tunnel Module", $localize`:@@settings.metadata.3a01760a2ddb:Split Tunnel Module`],
  ["Start the Split Tunnel module. If turned off, the Split Tunnel functionality is fully disabled on this device.", $localize`:@@settings.metadata.060b96f25c2a:Start the Split Tunnel module. If turned off, the Split Tunnel functionality is fully disabled on this device.`],
  ["Custom Filter List", $localize`:@@settings.metadata.b75be43c106c:Custom Filter List`],
  ["Specify the file path to a custom filter list (.txt), which will be automatically refreshed. Any connections matching a domain, IP address, Country or ASN in the file will be blocked.", $localize`:@@settings.metadata.555e0a86ad0e:Specify the file path to a custom filter list (.txt), which will be automatically refreshed. Any connections matching a domain, IP address, Country or ASN in the file will be blocked.`],
  ["Name", $localize`:@@settings.metadata.dcd1d5223f73:Name`],
  ["Human readable name of the Hub.", $localize`:@@settings.metadata.944b4219a92b:Human readable name of the Hub.`],
  ["Group", $localize`:@@settings.metadata.34ca0e766088:Group`],
  ["Name of the hub group this Hub belongs to.", $localize`:@@settings.metadata.0f0b70503a53:Name of the hub group this Hub belongs to.`],
  ["Contact Address", $localize`:@@settings.metadata.339d77ab4e01:Contact Address`],
  ["Contact address where the Hub operator can be reached.", $localize`:@@settings.metadata.2b43256c164d:Contact address where the Hub operator can be reached.`],
  ["Contact Service", $localize`:@@settings.metadata.90ced157c8da:Contact Service`],
  ["Name of the service the contact address corresponds to, if not email.", $localize`:@@settings.metadata.4f7b832510b1:Name of the service the contact address corresponds to, if not email.`],
  ["Hosters", $localize`:@@settings.metadata.91c8881ee1a9:Hosters`],
  ["List of all involved entities and organisations that are involved in hosting this Hub.", $localize`:@@settings.metadata.eee31744da74:List of all involved entities and organisations that are involved in hosting this Hub.`],
  ["Datacenter", $localize`:@@settings.metadata.730da5d73c76:Datacenter`],
  ["Identifier of the datacenter this Hub is hosted in.", $localize`:@@settings.metadata.2f3163b3abce:Identifier of the datacenter this Hub is hosted in.`],
  ["IPv4", $localize`:@@settings.metadata.b12b510bd093:IPv4`],
  ["IPv4 address of this Hub. Must be globally reachable.", $localize`:@@settings.metadata.ff8a5486fb16:IPv4 address of this Hub. Must be globally reachable.`],
  ["IPv6", $localize`:@@settings.metadata.0b0f0a267e77:IPv6`],
  ["IPv6 address of this Hub. Must be globally reachable.", $localize`:@@settings.metadata.38e9bca1e350:IPv6 address of this Hub. Must be globally reachable.`],
  ["Transports", $localize`:@@settings.metadata.7db2d5002ce0:Transports`],
  ["List of transports this Hub supports.", $localize`:@@settings.metadata.95d37796f2a4:List of transports this Hub supports.`],
  ["Entry", $localize`:@@settings.metadata.2649e082d9a2:Entry`],
  ["Define an entry policy. The format is the same for the endpoint lists. Default is permit.", $localize`:@@settings.metadata.e007a4a99ac2:Define an entry policy. The format is the same for the endpoint lists. Default is permit.`],
  ["Exit", $localize`:@@settings.metadata.d17d84a60499:Exit`],
  ["Define an exit policy. The format is the same for the endpoint lists. Default is permit.", $localize`:@@settings.metadata.b1aaf62f145d:Define an exit policy. The format is the same for the endpoint lists. Default is permit.`],
  ["Allow Unencrypted Connections", $localize`:@@settings.metadata.5cc11d4f2408:Allow Unencrypted Connections`],
  ["Advertise that this Hub is available for handling unencrypted connections, as detected by clients.", $localize`:@@settings.metadata.c2622e2ffa02:Advertise that this Hub is available for handling unencrypted connections, as detected by clients.`],
  ["SPN Module", $localize`:@@settings.metadata.d31f5935b54c:SPN Module`],
  ["Start the Safing Privacy Network module. If turned off, the SPN is fully disabled on this device.", $localize`:@@settings.metadata.bd14cb810bb3:Start the Safing Privacy Network module. If turned off, the SPN is fully disabled on this device.`],
  ["Home Node Rules", $localize`:@@settings.metadata.4b7e43c80ec9:Home Node Rules`],
  ["Customize which countries should or should not be used for your Home Node. The Home Node is your entry into the SPN. You connect directly to it and all your connections are routed through it.\n\nBy default, the Portmaster tries to choose the nearest node as your Home Node in order to reduce your exposure to the open Internet.\n\nReconnect to the SPN in order to apply new rules.", $localize`:@@settings.metadata.4ace627cefac:Customize which countries should or should not be used for your Home Node. The Home Node is your entry into the SPN. You connect directly to it and all your connections are routed through it.

By default, the Portmaster tries to choose the nearest node as your Home Node in order to reduce your exposure to the open Internet.

Reconnect to the SPN in order to apply new rules.`],
  ["DNS Exit Node Rules", $localize`:@@settings.metadata.97d6307e67ee:DNS Exit Node Rules`],
  ["Customize which countries should or should not be used as DNS Exit Nodes.\n\nBy default, the Portmaster will exit DNS requests directly at your Home Node in order to keep them fast and close to your location. This is important, as DNS resolution often takes your approximate location into account when deciding which optimized DNS records are returned to you. As the Portmaster encrypts your DNS requests by default, you effectively gain a two-hop security level for your DNS requests in order to protect your privacy.\n\nThis setting mainly exists for when you need to simulate your presence in another location on a lower level too. This might be necessary to defeat more intelligent geo-blocking systems.", $localize`:@@settings.metadata.1ea66f200a3f:Customize which countries should or should not be used as DNS Exit Nodes.

By default, the Portmaster will exit DNS requests directly at your Home Node in order to keep them fast and close to your location. This is important, as DNS resolution often takes your approximate location into account when deciding which optimized DNS records are returned to you. As the Portmaster encrypts your DNS requests by default, you effectively gain a two-hop security level for your DNS requests in order to protect your privacy.

This setting mainly exists for when you need to simulate your presence in another location on a lower level too. This might be necessary to defeat more intelligent geo-blocking systems.`],
  ["Use Community Nodes", $localize`:@@settings.metadata.b1b4f19d87cf:Use Community Nodes`],
  ["Use nodes (servers) not operated by Safing themselves. The use of community nodes is recommended as it diversifies the ownership of the nodes you use for your connections and further strengthens your privacy. Plain connections (eg. http, smtp, ...) will never exit via community nodes, making this setting safe to use.", $localize`:@@settings.metadata.e715fe297d94:Use nodes (servers) not operated by Safing themselves. The use of community nodes is recommended as it diversifies the ownership of the nodes you use for your connections and further strengthens your privacy. Plain connections (eg. http, smtp, ...) will never exit via community nodes, making this setting safe to use.`],
  ["Trust Nodes", $localize`:@@settings.metadata.40b4ec0b072b:Trust Nodes`],
  ["Specify which community nodes to additionally trust. These nodes may then also be used as a Home Node, as well as an Exit Node for unencrypted connections.", $localize`:@@settings.metadata.3ff8ec3f342b:Specify which community nodes to additionally trust. These nodes may then also be used as a Home Node, as well as an Exit Node for unencrypted connections.`],
  ["Special Access Code", $localize`:@@settings.metadata.263014bcde81:Special Access Code`],
  ["Special Access Codes grant access to the SPN for testing or evaluation purposes.", $localize`:@@settings.metadata.f59383ca06a4:Special Access Codes grant access to the SPN for testing or evaluation purposes.`],
  ["Connect From Advertised IPs Only", $localize`:@@settings.metadata.fe3bbd945d42:Connect From Advertised IPs Only`],
  ["Only connect from (bind to) the advertised IP addresses.", $localize`:@@settings.metadata.bff26ff7d3f0:Only connect from (bind to) the advertised IP addresses.`],
  ["Block .onion, .i2p, .loki, .bit, .eth, .888, .bitcoin, .coin, .crypto, .dao, .nft, .wallet, .x, .zil, .bazar, .coin, .emc, .lib, .bbs, .chan, .dyn, .free, .fur, .geek, .glue, .gopher, .indy, .libre, .neo, .null, .o, .oss, .oz, .parody, .pirate, .ku, .te, .ti, .uu. Unofficial domains may pose a security risk. This setting does not affect .onion domains in the Tor Browser.", $localize`:@@settings.metadata.b25b3d512196:Block .onion, .i2p, .loki, .bit, .eth, .888, .bitcoin, .coin, .crypto, .dao, .nft, .wallet, .x, .zil, .bazar, .coin, .emc, .lib, .bbs, .chan, .dyn, .free, .fur, .geek, .glue, .gopher, .indy, .libre, .neo, .null, .o, .oss, .oz, .parody, .pirate, .ku, .te, .ti, .uu. Unofficial domains may pose a security risk. This setting does not affect .onion domains in the Tor Browser.`],
  ["Rules are checked from top to bottom, stopping after the first match. They can match:\n\n- By address: `192.168.0.1`\n- By network: `192.168.0.0/24`\n- By network scope: `Localhost`, `LAN` or `Internet`\n- By domain:\n\t- Matching a distinct domain: `example.com`\n\t- Matching a domain with subdomains: `.example.com`\n\t- Matching with a wildcard prefix: `*xample.com`\n\t- Matching with a wildcard suffix: `example.*`\n\t- Matching domains containing text: `*example*`\n- By country (based on IP): `US` ([two-letter country codes according to ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2))\n- By continent (based on IP): `C:US` (prefix `AF`, `AN`, `AS`, `EU`, `NA`, `OC`, or `SA` with `C:`)\n- By AS number: `AS123456`\n- By filter list - use the filterlist ID prefixed with `L:`: `L:MAL`\n- Match anything: `*`\n\nAdditionally, you may supply a protocol and port using this format: `<host> <IP protocol>/<port>`.\n\nProtocols and ports may be specified using numbers (`6/80`) or names (`TCP/HTTP`).  \nPort ranges are defined by using a hyphen (`TCP/1-1024`). Omit the port to match any.  \nUse a `*` for matching any protocol. If matching ports with any protocol, protocols without ports will not match.  \nRules with protocol and port definitions only match if the protocol and port also match.  \nPorts are always compared to the destination port, thus, the local listening port for incoming connections.  \n\nExamples:\n- `192.168.0.1 TCP/HTTP`\n- `LAN UDP/50000-55000`\n- `example.com */HTTPS`\n- `1.1.1.1 ICMP`\n\nImportant: DNS Requests are only matched against domain and filter list rules, all others require an IP address and are checked only with the following IP connection.\n\nPro Tip: You can use `#` to add a comment to a rule.\n", $localize`:@@settings.metadata.be398992aa60:Rules are checked from top to bottom, stopping after the first match. They can match:

- By address: \`192.168.0.1\`
- By network: \`192.168.0.0/24\`
- By network scope: \`Localhost\`, \`LAN\` or \`Internet\`
- By domain:
	- Matching a distinct domain: \`example.com\`
	- Matching a domain with subdomains: \`.example.com\`
	- Matching with a wildcard prefix: \`*xample.com\`
	- Matching with a wildcard suffix: \`example.*\`
	- Matching domains containing text: \`*example*\`
- By country (based on IP): \`US\` ([two-letter country codes according to ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2))
- By continent (based on IP): \`C:US\` (prefix \`AF\`, \`AN\`, \`AS\`, \`EU\`, \`NA\`, \`OC\`, or \`SA\` with \`C:\`)
- By AS number: \`AS123456\`
- By filter list - use the filterlist ID prefixed with \`L:\`: \`L:MAL\`
- Match anything: \`*\`

Additionally, you may supply a protocol and port using this format: \`<host> <IP protocol>/<port>\`.

Protocols and ports may be specified using numbers (\`6/80\`) or names (\`TCP/HTTP\`).  
Port ranges are defined by using a hyphen (\`TCP/1-1024\`). Omit the port to match any.  
Use a \`*\` for matching any protocol. If matching ports with any protocol, protocols without ports will not match.  
Rules with protocol and port definitions only match if the protocol and port also match.  
Ports are always compared to the destination port, thus, the local listening port for incoming connections.  

Examples:
- \`192.168.0.1 TCP/HTTP\`
- \`LAN UDP/50000-55000\`
- \`example.com */HTTPS\`
- \`1.1.1.1 ICMP\`

Important: DNS Requests are only matched against domain and filter list rules, all others require an IP address and are checked only with the following IP connection.

Pro Tip: You can use \`#\` to add a comment to a rule.
`],
  ["Rules are checked from top to bottom, stopping after the first match. They can match the following attributes of SPN Nodes:\n\n- Country (based on IPs): `US` (two-letter country codes according to ISO 3166-1 alpha-2)\n- AS number: `AS123456`\n- Address: `192.168.0.1`\n- Network: `192.168.0.1/24`\n- Anything: `*`\n", $localize`:@@settings.metadata.b652872ae3e2:Rules are checked from top to bottom, stopping after the first match. They can match the following attributes of SPN Nodes:

- Country (based on IPs): \`US\` (two-letter country codes according to ISO 3166-1 alpha-2)
- AS number: \`AS123456\`
- Address: \`192.168.0.1\`
- Network: \`192.168.0.1/24\`
- Anything: \`*\`
`],
  ["DNS servers are used in the order as entered. The first one will be used as the primary DNS Server. Only if it fails, will the other servers be used as a fallback - in their respective order. If all fail, or if no DNS Server is configured here, the Portmaster will use the one configured in your system or network.\n\nAdditionally, if it is more likely that the DNS server of your system or network has a (better) answer to a request, they will be asked first. This will be the case for special local domains and domain spaces announced on the current network.\n\nDNS servers are configured in a URL format. This allows you to specify special settings for a resolver. If you just want to use a resolver at IP 10.2.3.4, please enter: `dns://10.2.3.4`  \nThe format is: `protocol://host:port?parameter=value&parameter=value`  \n\nFor DoH servers, you can also just paste the URL given by the DNS provider.  \nWhen referring to the DNS server using a domain name, as with DoH, it is highly recommended to also specify the IP address using the `ip` parameter, so Portmaster does not have to resolve it.\n\n- Protocol\n\t- `dot`: DNS-over-TLS (or `tls`; recommended)  \n\t- `doh`: DNS-over-HTTPS (or `https`)\n\t- `dns`: plain old DNS  \n\t- `tcp`: plain old DNS over TCP\n- Host: specify the domain or IP of the resolver\n- Port: optionally define a custom port\n- Parameters:\n\t- `name`: give your DNS Server a name that is used for messages and logs\n\t- `verify`: domain name to verify for `dot`, only valid for `dot` and `doh`\n\t- `ip`: IP address (if using a domain), so Portmaster does not need to resolve it using the system resolver - this is highly recommended\n\t- `blockedif`: detect if the name server blocks a query, options:\n\t\t- `empty`: server replies with NXDomain status, but without any other record in any section\n\t\t- `refused`: server replies with Refused status\n\t\t- `zeroip`: server replies with an IP address, but it is zero\n\t- `search`: specify prioritized domains/TLDs for this resolver (delimited by `,`)\n\t- `search-only`: use this resolver for domains in the `search` parameter only (no value)\n", $localize`:@@settings.metadata.59c5b44dccb5:DNS servers are used in the order as entered. The first one will be used as the primary DNS Server. Only if it fails, will the other servers be used as a fallback - in their respective order. If all fail, or if no DNS Server is configured here, the Portmaster will use the one configured in your system or network.

Additionally, if it is more likely that the DNS server of your system or network has a (better) answer to a request, they will be asked first. This will be the case for special local domains and domain spaces announced on the current network.

DNS servers are configured in a URL format. This allows you to specify special settings for a resolver. If you just want to use a resolver at IP 10.2.3.4, please enter: \`dns://10.2.3.4\`  
The format is: \`protocol://host:port?parameter=value&parameter=value\`  

For DoH servers, you can also just paste the URL given by the DNS provider.  
When referring to the DNS server using a domain name, as with DoH, it is highly recommended to also specify the IP address using the \`ip\` parameter, so Portmaster does not have to resolve it.

- Protocol
	- \`dot\`: DNS-over-TLS (or \`tls\`; recommended)  
	- \`doh\`: DNS-over-HTTPS (or \`https\`)
	- \`dns\`: plain old DNS  
	- \`tcp\`: plain old DNS over TCP
- Host: specify the domain or IP of the resolver
- Port: optionally define a custom port
- Parameters:
	- \`name\`: give your DNS Server a name that is used for messages and logs
	- \`verify\`: domain name to verify for \`dot\`, only valid for \`dot\` and \`doh\`
	- \`ip\`: IP address (if using a domain), so Portmaster does not need to resolve it using the system resolver - this is highly recommended
	- \`blockedif\`: detect if the name server blocks a query, options:
		- \`empty\`: server replies with NXDomain status, but without any other record in any section
		- \`refused\`: server replies with Refused status
		- \`zeroip\`: server replies with an IP address, but it is zero
	- \`search\`: specify prioritized domains/TLDs for this resolver (delimited by \`,\`)
	- \`search-only\`: use this resolver for domains in the \`search\` parameter only (no value)
`],
  ["You can specify nodes by their ID or their verified operator.", $localize`:@@settings.metadata.fe914abc31ff:You can specify nodes by their ID or their verified operator.`],
]);

export function localizeSettingText(value: string | null | undefined): string {
  return value ? messages.get(value) ?? value : '';
}

@Pipe({ name: 'settingText' })
export class SettingTextPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return localizeSettingText(value);
  }
}
