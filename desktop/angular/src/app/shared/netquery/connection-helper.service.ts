import { DOCUMENT, formatDate } from '@angular/common';
import { Inject, Injectable, LOCALE_ID, Renderer2, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppProfile, AppProfileService, ConfigService, IPScope, NetqueryConnection, Pin, PossilbeValue, QueryResult, SPNService, Verdict, deepClone, flattenProfileConfig, getAppSetting, setAppSetting } from '@safing/portmaster-api';
import { BehaviorSubject, Observable, OperatorFunction, Subject, combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ActionIndicatorService } from '../action-indicator';
import { localizeSettingText } from '../config/setting-text.pipe';
import { objKeys } from '../utils';
import { SfngSearchbarFields } from './searchbar';
import { connectionValueLabel, localizeConnectionReason } from './utils';
import { CountryNameService } from './pipes/country-name.pipe';
import { INTEGRATION_SERVICE } from 'src/app/integration';

// Stable English query aliases; localized labels are display-only in connectionValueLabel.
export const IPScopeNames: { [key in IPScope]: string } = {
  [IPScope.Invalid]: "Invalid",
  [IPScope.Undefined]: "Undefined",
  [IPScope.HostLocal]: "Device Local",
  [IPScope.LinkLocal]: "Link Local",
  [IPScope.SiteLocal]: "LAN",
  [IPScope.Global]: "Internet",
  [IPScope.LocalMulticast]: "LAN Multicast",
  [IPScope.GlobalMulitcast]: "Internet Multicast"
}

export interface LocalAppProfile extends AppProfile {
  FlatConfig: { [key: string]: any }
}

@Injectable()
export class NetqueryHelper {
  readonly reasonText = localizeConnectionReason;
  readonly settings: { [key: string]: string } = {};

  refresh = new Subject<void>();

  private onShiftKey$ = new BehaviorSubject<boolean>(false);
  private onCtrlKey$ = new BehaviorSubject<boolean>(false);
  private addToFilter$ = new Subject<SfngSearchbarFields>();
  private destroy$ = new Subject<void>();
  private appProfiles$ = new BehaviorSubject<LocalAppProfile[]>([]);
  private spnMapPins$ = new BehaviorSubject<Pin[] | null>(null);
  private readonly integration = inject(INTEGRATION_SERVICE);
  private readonly countryNames = inject(CountryNameService);
  private readonly localeId = inject(LOCALE_ID);

  readonly onShiftKey: Observable<boolean>;
  readonly onCtrlKey: Observable<boolean>;

  constructor(
    private router: Router,
    private profileService: AppProfileService,
    private configService: ConfigService,
    private actionIndicator: ActionIndicatorService,
    private renderer: Renderer2,
    private spnService: SPNService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    const cleanupKeyDown = this.renderer.listen(this.document, 'keydown', (event: KeyboardEvent) => {
      if (event.shiftKey) {
        this.onShiftKey$.next(true)
      }
      if (event.ctrlKey) {
        this.onCtrlKey$.next(true);
      }
    });

    const cleanupKeyUp = this.renderer.listen(this.document, 'keyup', () => {
      this.onShiftKey$.next(false);
      this.onCtrlKey$.next(false);
    })

    const windowBlur = this.renderer.listen(window, 'blur', () => {
      this.onShiftKey$.next(false);
      this.onCtrlKey$.next(false);
    })

    this.destroy$.subscribe({
      complete: () => {
        cleanupKeyDown();
        cleanupKeyUp();
        windowBlur();
      }
    })

    this.onShiftKey = this.onShiftKey$
      .pipe(distinctUntilChanged());

    this.onCtrlKey = this.onCtrlKey$
      .pipe(distinctUntilChanged());

    this.configService.query('')
      .subscribe(settings => {
        settings.forEach(setting => {
          this.settings[setting.Key] = localizeSettingText(setting.Name);
        });
        this.refresh.next();
      });

    // watch all application profiles
    this.profileService.watchProfiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe(profiles => {
        this.appProfiles$.next((profiles || []).map(p => {
          return {
            ...p,
            FlatConfig: flattenProfileConfig(p.Config),
          }
        }))
      });

    this.spnService.watchPins()
      .pipe(takeUntil(this.destroy$))
      .subscribe(pins => {
        this.spnMapPins$.next(pins);
      })
  }

  decodePrettyValues(field: keyof NetqueryConnection, values: any[]): any[] {
    if (field === 'verdict') {
      return values.map(val => {
        if (typeof val !== 'string') return val;
        const verdict = Verdict[val as keyof typeof Verdict];
        return typeof verdict === 'number' ? verdict : val;
      });
    }

    if (field === 'scope') {
      return values.map(val => {
        if (typeof val !== 'string') return val;
        const scopeValue = IPScope[val as keyof typeof IPScope];
        if (typeof scopeValue === 'number') return scopeValue;

        // Decode stable English aliases only, never localized display labels.
        const scope = objKeys(IPScopeNames).find(scope => IPScopeNames[scope].toLowerCase() === val.toLowerCase());
        return scope === undefined ? val : Number(scope);
      });
    }

    if (field === 'allowed') {
      return values.map(val => {
        if (typeof val !== 'string') {
          return val
        }

        switch (val.toLocaleLowerCase()) {
          case 'yes':
            return true
          case 'no':
            return false
          case 'n/a':
          case 'null':
            return null
          default:
            return val
        }
      })
    }

    if (field === 'exit_node') {
      const lm = new Map<string, Pin>();
      (this.spnMapPins$.getValue() || [])
        .forEach(pin => lm.set(pin.Name, pin));

      return values.map(val => lm.get(val)?.ID || val)
    }

    return values;
  }

  attachProfile(): OperatorFunction<QueryResult[], (QueryResult & { __profile?: LocalAppProfile })[]> {
    return source => combineLatest([
      source,
      this.appProfiles$,
    ]).pipe(
      map(([items, profiles]) => {
        let lm = new Map<string, LocalAppProfile>();
        profiles.forEach(profile => {
          lm.set(`${profile.Source}/${profile.ID}`, profile)
        })

        return items.map(item => {
          if ('profile' in item) {
            item.__profile = lm.get(item.profile!)
          }

          return item;
        })
      })
    )
  }

  attachPins(): OperatorFunction<QueryResult[], (QueryResult & { __exitNode?: Pin })[]> {
    return source => combineLatest([
      source,
      this.spnMapPins$
        .pipe(
          filter(result => result !== null),
          take(1),
        ),
    ]).pipe(
      map(([items, pins]) => {
        let lm = new Map<string, Pin>();
        pins!.forEach(pin => {
          lm.set(pin.ID, pin)
        })

        return items.map(item => {
          if ('exit_node' in item) {
            item.__exitNode = lm.get(item.exit_node!)
          }

          return item;
        })
      })
    )
  }

  encodeToPossibleValues(field: string): OperatorFunction<QueryResult[], (QueryResult & PossilbeValue)[]> {
    return source => combineLatest([
      source,
      this.appProfiles$,
      this.spnMapPins$,
    ]).pipe(
      map(([items, profiles, pins]) => {
        // convert profile IDs to profile name
        if (field === 'profile') {
          let lm = new Map<string, AppProfile>();
          profiles.forEach(profile => {
            lm.set(`${profile.Source}/${profile.ID}`, profile)
          })

          return items.map((item: any) => {
            const profile = lm.get(item.profile!)
            return {
              Name: profile?.Name || `${item.profile}`,
              Value: item.profile!,
              Description: '',
              __profile: profile || null,
              ...item,
            }
          })
        }

        if (field === 'allowed') {
          return items
            // we remove any "null" value from allowed here as it may happen for a really short
            // period of time and there's no reason to actually filter for them because
            // from showing a "null" value to the user clicking it the connection will have been
            // verdicted and thus no results will show up for "null".
            .filter(item => typeof item.allowed === 'boolean')
            .map(item => {
              return {
                Name: connectionValueLabel(field, item.allowed),
                Value: item.allowed,
                Description: '',
                ...item
              }
            })
        }

        if (field === 'exit_node') {
          const lm = new Map<string, Pin>();
          (pins || []).forEach(pin => lm.set(pin.ID, pin));

          return items.map(item => {
            const pin = lm.get(item.exit_node!);
            return {
              Name: pin?.Name || item.exit_node,
              Value: item.exit_node,
              Description: $localize`:@@netquery.operatedBy:Operated by ${pin?.VerifiedOwner || connectionValueLabel('', null)}:OWNER:`,
              ...item
            }
          })
        }

        // Keep the raw Value separate from its display Name, including unknown values.
        return items.map(item => {
          const value = item[field];
          let name = connectionValueLabel(field, value);
          if (field === 'country' && typeof value === 'string') {
            name = this.countryNames.resolveName(value) || name;
          } else if ((field === 'from' || field === 'to') && typeof value === 'string' && !isNaN(Date.parse(value))) {
            name = formatDate(value, 'medium', this.localeId);
          }
          return { Name: name, Value: value, Description: '', ...item };
        })
      })
    )
  }

  dispose() {
    this.onShiftKey$.complete();

    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Emits added fields whenever addToFilter is called */
  onFieldsAdded(): Observable<SfngSearchbarFields> {
    return this.addToFilter$.asObservable();
  }

  /** Adds a new filter to the current query */
  addToFilter(key: string, value: any[]) {
    this.addToFilter$.next({
      [key]: value,
    })
  }

  /**
   * @private
   * Returns the class used to color the connection's
   * verdict.
   *
   * @param conn The connection object
   */
  getVerdictClass(conn: NetqueryConnection): string {
    return Verdict[conn.verdict]?.toLocaleLowerCase() || `unknown-verdict<${conn.verdict}>`;
  }

  /**
   * @private
   * Redirect the user to a settings key in the application
   * profile.
   *
   * @param key The settings key to redirect to
   */
  redirectToSetting(setting: string, conn: NetqueryConnection, globalSettings = false) {
    const reason = conn.extra_data?.reason;
    if (!reason) {
      return;
    }

    if (!setting) {
      setting = reason.OptionKey;
    }

    if (!setting) {
      return;
    }

    if (globalSettings) {
      this.router.navigate(
        ['/', 'settings'], {
        queryParams: {
          setting: setting,
        }
      })
      return;
    }

    let profile = conn.profile

    if (!!reason.Profile) {
      profile = reason.Profile;
    }

    if (profile.startsWith("core:profiles/")) {
      profile = profile.replace("core:profiles/", "")
    }

    this.router.navigate(
      ['/', 'app', ...profile.split("/")], {
      queryParams: {
        tab: 'settings',
        setting: setting,
      }
    })
  }

  /**
   * @private
   * Redirect the user to "outgoing rules" setting in the
   * application profile/settings.
   */
  redirectToRules(conn: NetqueryConnection) {
    if (conn.direction === 'inbound') {
      this.redirectToSetting('filter/serviceEndpoints', conn);
    } else {
      this.redirectToSetting('filter/endpoints', conn);
    }
  }

  /**
   * @private
   * Dump a connection to the console
   *
   * @param conn The connection to dump
   */
  async dumpConnection(conn: NetqueryConnection) {
    // Copy to clip-board if supported
    try {
      await this.integration.writeToClipboard(JSON.stringify(conn, undefined, "    "))
      this.actionIndicator.info($localize`:@@netquery.connectionCopied:Copied to Clipboard`)
    } catch (err: any) {
      this.actionIndicator.error($localize`:@@netquery.connectionCopyFailed:Copy to Clipboard Failed`, err?.message || JSON.stringify(err))
    }
  }

  /**
   * @private
   * Creates a new "block domain" outgoing rules
   */
  blockAll(domain: string, conn: NetqueryConnection) {
    /* Deactivate until exact behavior is specified.
    if (this.isDomainBlocked(domain)) {
      this.actionIndicator.info(domain + ' already blocked')
      return;
    }
    */

    domain = domain.replace(/\.+$/, '');
    const newRule = `- ${domain}`;
    this.updateRules(newRule, true, conn)
  }

  /**
   * @private
   * Removes a "block domain" rule from the outgoing rules
   */
  unblockAll(domain: string, conn: NetqueryConnection) {
    /* Deactivate until exact behavior is specified.
    if (!this.isDomainBlocked(domain)) {
      this.actionIndicator.info(domain + ' already allowed')
      return;
    }
    */

    domain = domain.replace(/\.+$/, '');
    const newRule = `+ ${domain}`;
    this.updateRules(newRule, true, conn);
  }

  /**
   * Updates the outgoing rule set and either creates or deletes
   * a rule. If a rule should be created but already exists
   * it is moved to the top.
   *
   * @param newRule The new rule to create or delete.
   * @param add  Whether or not to create or delete the rule.
   */
  private updateRules(newRule: string, add: boolean, conn: NetqueryConnection) {
    if (!conn.profile) {
      return
    }

    let key = 'filter/endpoints';
    if (conn.direction === 'inbound') {
      key = 'filter/serviceEndpoints'
    }

    this.profileService.getAppProfile(conn.profile)
      .pipe(
        switchMap(profile => {
          let rules = getAppSetting<string[]>(profile.Config, key) || [];
          rules = rules.filter(rule => rule !== newRule);

          if (add) {
            rules.splice(0, 0, newRule)
          }

          const newProfile = deepClone(profile);

          if (newProfile.Config === null || newProfile.Config === undefined) {
            newProfile.Config = {}
          }

          setAppSetting(newProfile.Config, key, rules);

          return this.profileService.saveProfile(newProfile)
        })
      )
      .subscribe({
        next: () => {
          if (add) {
            this.actionIndicator.success($localize`:@@netquery.rulesUpdated:Rules Updated`, $localize`:@@netquery.ruleCreated:Successfully created a new rule.`)
          } else {
            this.actionIndicator.success($localize`:@@netquery.rulesUpdated:Rules Updated`, $localize`:@@netquery.ruleRemoved:Successfully removed matching rule.`)
          }
        },
        error: err => {
          this.actionIndicator.error($localize`:@@netquery.rulesUpdateFailed:Failed to update rules`, JSON.stringify(err))
        }
      });
  }
}
