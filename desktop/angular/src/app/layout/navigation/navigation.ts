import { INTEGRATION_SERVICE, IntegrationService } from 'src/app/integration';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { ConfigService, DebugAPI, PortapiService, SPNService, StringSetting, BoolSetting } from '@safing/portmaster-api';
import { tap } from 'rxjs/operators';
import { AppComponent } from 'src/app/app.component';
import { NotificationType, NotificationsService, StatusService, VersionStatus, GetModuleState, ControlPauseStateData } from 'src/app/services';
import { ActionIndicatorService } from 'src/app/shared/action-indicator';
import { fadeInAnimation, fadeOutAnimation } from 'src/app/shared/animations';
import { ExitService } from 'src/app/shared/exit-screen';
import { TauriIntegrationService } from 'src/app/integration/taur-app';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss'],
  exportAs: 'navigation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    fadeInAnimation,
    fadeOutAnimation,
  ]
})
export class NavigationComponent implements OnInit {
  private readonly integration = inject(INTEGRATION_SERVICE);

  /** Emits the current portapi connection state on changes. */
  readonly connected$ = this.portapi.connected$;

  /** @private The available and selected resource versions. */
  versions: VersionStatus | null = null;

  /** Whether or not we have new, unseen notifications */
  hasNewNotifications = false;

  /** The color to use for the notifcation-available hint (dot) */
  notificationColor: string = 'text-green-300';

  pauseState: ControlPauseStateData | null = null;
  get isPaused(): boolean { return this.pauseState?.Interception===true || this.pauseState?.SPN===true; }
  get isPausedInterception(): boolean { return this.pauseState?.Interception===true; }
  get isPausedSPN(): boolean { return this.pauseState?.SPN===true; }
  get pauseInfo(): string {
    if (this.pauseState?.Interception===true && this.pauseState?.SPN===true) 
      return $localize`:@@ts.navigation.pausedAll:Portmaster and SPN are paused`;
    else if (this.pauseState?.Interception===true)
      return $localize`:@@ts.navigation.pausedPortmaster:Portmaster is paused`;
    else if (this.pauseState?.SPN===true)
      return $localize`:@@ts.navigation.pausedSpn:SPN is paused`;
    return '';
  }
  get pauseInfoTillTime(): string {
    if (this.isPaused && this.pauseState?.TillTime) {
      const date = new Date(this.pauseState.TillTime);
      if (isNaN(date.getTime()) || date.getTime() < Date.now())
        return '';    
      return $localize`:@@pause.autoResume:Auto-resume at ${date.toLocaleTimeString(undefined, { hour12: false })}:time:`;
    }
    return '';
  }

  /** Whether or not we have new, unseen prompts */
  hasNewPrompts = false;

  /** Whether or not prompting is globally enabled. */
  globalPromptingEnabled = false;

  /** Whether or not the SPN is currently enabled */
  spnEnabled = false;

  @Output()
  sideDashChange = new EventEmitter<'collapsed' | 'expanded' | 'force-overlay'>();

  /** Whether or not the side dash should be expanded or collapsed */
  sideDashStatus: 'collapsed' | 'expanded' = 'expanded';

  constructor(
    private portapi: PortapiService,
    private exitService: ExitService,
    private statusService: StatusService,
    private configService: ConfigService,
    private appComponent: AppComponent,
    private debugAPI: DebugAPI,
    private actionIndicator: ActionIndicatorService,
    private notificationService: NotificationsService,
    private spnService: SPNService,
    private cdr: ChangeDetectorRef
  ) { }

  dropDownPositions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'top'
    }
  ]

  ngOnInit() {
    const mql = window.matchMedia('(max-width: 1200px)');

    if (mql.matches) {
      this.sideDashStatus = 'collapsed';
      this.sideDashChange.next(this.sideDashStatus);
    }

    mql.addEventListener('change', () => {
      if (mql.matches) {
        this.sideDashStatus = 'collapsed';
      } else {
        this.sideDashStatus = 'expanded';
      }
      this.sideDashChange.next(this.sideDashStatus);
    })

    this.statusService.getVersions()
      .subscribe(versions => {
        this.versions = versions;
        this.cdr.markForCheck();
      });

    this.statusService.status$.subscribe(status => {
      this.pauseState = GetModuleState(status, 'Control', 'control:paused')?.Data || null;
    });

    this.configService.watch<StringSetting>('filter/defaultAction')
      .subscribe(defaultAction => {
        this.globalPromptingEnabled = defaultAction === 'ask';
        this.cdr.markForCheck();
      })
    
    this.configService.watch<BoolSetting>("spn/enable")
      .subscribe(value => {
        this.spnEnabled = value;
        this.cdr.markForCheck();
      });

    this.notificationService.new$
      .subscribe(notif => {


        if (notif.some(n => n.Type === NotificationType.Prompt && n.EventID.startsWith("filter:prompt"))) {
          this.hasNewPrompts = true;

          if (this.integration instanceof TauriIntegrationService) {
            this.integration.openPrompt();
          }
        } else {
          this.hasNewPrompts = false;

          if (this.integration instanceof TauriIntegrationService) {
            this.integration.closePrompt();
          }
        }

        if (notif.some(n => !n.EventID.startsWith("filter:prompt"))) {
          this.hasNewNotifications = true;
        } else {
          this.hasNewNotifications = false;
        }

        if (notif.some(n => n.Type === NotificationType.Error)) {
          this.notificationColor = 'text-red-300';
        } else if (notif.some(n => n.Type === NotificationType.Warning)) {
          this.notificationColor = 'text-yellow-300';
        } else {
          this.notificationColor = 'text-green-300';
        }

        this.cdr.markForCheck();
      })
  }

  toggleSideDash(event: MouseEvent) {
    let notify: 'expanded' | 'collapsed' | 'force-overlay' = this.sideDashStatus;

    if (this.sideDashStatus === 'collapsed') {
      this.sideDashStatus = 'expanded';
      notify = 'expanded';
      if (event.shiftKey) {
        notify = 'force-overlay'
      }
    } else {
      this.sideDashStatus = 'collapsed';
      notify = 'collapsed'
    }

    this.sideDashChange.next(notify);
  }

  /**
   * @private
   * Injects a ui/reload event and performs a complete
   * reload of the window once the portmaster re-opened the
   * UI bundle.
   */
  reloadUI(_: Event) {
    this.portapi.reloadUI()
      .pipe(
        tap(() => {
          setTimeout(() => window.location.reload(), 1000)
        })
      )
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.reloadingUi:Reloading UI ...`,
        $localize`:@@ts.navigation.reloadUiFailed:Failed to Reload UI`,
      ))
  }

  /** Re-initialize the SPN */
  reinitSPN(_: Event) {
    this.portapi.reinitSPN()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.reinitializedSpn:Re-initialized SPN`,
        $localize`:@@ts.navigation.reinitializeSpnFailed:Failed to re-initialize the SPN`
      ))
  }

  /** Logs the user out of the SPN completely by purgin the user profile from the local storage */
  logoutCompletely(_: Event) {
    this.spnService.logout(true)
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.logout:Logout`,
        $localize`:@@ts.navigation.loggedOutCompletely:You have been logged out of the SPN completely.`
      ))
  }

  /**
   * @private
   * Clear the DNS name cache.
   */
  clearDNSCache(_: Event) {
    this.portapi.clearDNSCache()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.dnsCacheCleared:DNS Cache Cleared`,
        $localize`:@@ts.navigation.clearDnsCacheFailed:Failed to Clear DNS Cache.`,
      ))
  }

  cleanupHistory(_: Event) {
    this.portapi.cleanupHistory()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.historyCleaned:Network History Cleaned Up`,
        $localize`:@@ts.navigation.cleanupHistoryFailed:Failed to Cleanup Network History.`
      ))
  }

  /**
   * @private
   * Trigger downloading of updates
   *
   * @param event - The mouse event
   */
  downloadUpdates(event: Event) {
    this.portapi.checkForUpdates()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.downloadingUpdates:Downloading Updates ...`,
        $localize`:@@ts.navigation.checkUpdatesFailed:Failed to Check for Updates`,
      ))
  }

  /**
   * @private
   * Trigger a shutdown of the portmaster-core service
   */
  shutdown(_: Event) {
    this.exitService.shutdownPortmaster();
  }

  /**
   * @private
   * Trigger a restart of the portmaster-core service. Requires
   * that portmaster has been started with a service-wrapper.
   *
   * @param event The mouse event
   */
  restart(event: Event) {
    // prevent default and stop-propagation to avoid
    // expanding the accordion body.
    event.preventDefault();
    event.stopPropagation();

    this.portapi.restartPortmaster()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.restarting:Restarting ...`,
        $localize`:@@ts.navigation.restartFailed:Failed to Restart`,
      ))
  }

   pause(event: Event, duration: number) {
    // prevent default and stop-propagation to avoid
    // expanding the accordion body.
    event.preventDefault();
    event.stopPropagation();

    this.portapi.pause(duration, false)
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.pausing:Pausing ...`,
        $localize`:@@ts.navigation.pauseFailed:Failed to Pause`,
      ))
  }
  pauseSPN(event: Event, duration: number) {
    // prevent default and stop-propagation to avoid
    // expanding the accordion body.
    event.preventDefault();
    event.stopPropagation();

    this.portapi.pause(duration, true)
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.pausingSpn:Pausing SPN...`,
        $localize`:@@ts.navigation.pauseSpnFailed:Failed to Pause SPN`,
      ))
  }
  resume(event: Event) {
    // prevent default and stop-propagation to avoid
    // expanding the accordion body.
    event.preventDefault();
    event.stopPropagation();

    let msg = $localize`:@@ts.navigation.resuming:Resuming ...`;
    if (this.pauseState?.Interception===true && this.pauseState?.SPN===true) 
      msg = $localize`:@@ts.navigation.resumingAll:Resuming Portmaster and SPN ...`;
    else if (this.pauseState?.Interception===true)
      msg = $localize`:@@ts.navigation.resumingPortmaster:Resuming Portmaster ...`;
    else if (this.pauseState?.SPN===true)
      msg = $localize`:@@ts.navigation.resumingSpn:Resuming SPN ...`;

    this.portapi.resume()
      .subscribe(this.actionIndicator.httpObserver(
        msg,
        $localize`:@@ts.navigation.resumeFailed:Failed to Resume`,
      ))
  }
    
  /**
   * @private
   * Opens the data directory of the portmaster installation in the
   * system file manager. Not supported when running in a browser.
   */
  openDataDir(event: Event) {
    this.integration.openDir('data')
      .catch(err => this.actionIndicator.error($localize`:@@ts.navigation.openDataDirectoryFailed:Failed to open data directory`, err));
  }

  openChangeLog() {
    const url = "https://github.com/safing/portmaster/releases";
    this.integration.openExternal(url);
  }

  showIntro() {
    this.appComponent.showIntro()
  }

  resetBroadcastState() {
    this.portapi.resetBroadcastState()
      .subscribe(this.actionIndicator.httpObserver(
        $localize`:@@ts.navigation.notificationsStateCleared:Notifications State Cleared`,
        $localize`:@@ts.navigation.resetNotificationsStateFailed:Failed to Reset Notifications State.`,
      ))
  }

  copyDebugInfo(event: Event) {
    // prevent default and stop-propagation to avoid
    // expanding the accordion body.
    event.preventDefault();
    event.stopPropagation();

    this.debugAPI.getCoreDebugInfo()
      .subscribe(
        async info => {
          await this.integration.writeToClipboard(info);
        },
        err => {
          console.error(err);
          this.actionIndicator.error($localize`:@@ts.navigation.loadDebugDataFailed:Failed loading debug data`, err);
        }
      )
  }
}
