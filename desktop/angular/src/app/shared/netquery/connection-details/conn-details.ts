import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from "@angular/core";
import { ConnectionBandwidthChartResult, IPProtocol, IPScope, IsDenied, IsDNSRequest, Netquery, NetqueryConnection, PortapiService, Process, Verdict } from "@safing/portmaster-api";
import { SfngDialogService } from '@safing/ui';
import { Subscription } from "rxjs";
import { ProcessDetailsDialogComponent } from '../../process-details-dialog';
import { NetqueryHelper } from "../connection-helper.service";
import { DefaultBandwidthChartConfig } from "../line-chart/line-chart";
import { connectionValueLabel } from "../utils";



@Component({
  selector: 'sfng-netquery-conn-details',
  styleUrls: ['./conn-details.scss'],
  templateUrl: './conn-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SfngNetqueryConnectionDetailsComponent implements OnInit, OnDestroy, OnChanges {
  helper = inject(NetqueryHelper)
  private readonly portapi = inject(PortapiService)
  private readonly dialog = inject(SfngDialogService)
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly netquery = inject(Netquery)

  @Input()
  conn: NetqueryConnection | null = null;

  process: Process | null = null;

  readonly IsDNS = IsDNSRequest;
  readonly valueLabel = connectionValueLabel;
  readonly notAvailable = connectionValueLabel('', null);
  readonly Protocols = IPProtocol;
  readonly scopes = IPScope;
  private _subscription = Subscription.EMPTY;

  readonly formatBytes = DefaultBandwidthChartConfig.valueFormat;
  readonly formatTime = DefaultBandwidthChartConfig.timeFormat;
  readonly tooltipFormat = DefaultBandwidthChartConfig.tooltipFormat;
  readonly chartLabels = {
    started: $localize`:@@netquery.chart.started:started`,
    ended: $localize`:@@netquery.chart.ended:ended`,
  };

  connectionNotice: string = '';
  bwData: ConnectionBandwidthChartResult[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (!!changes?.conn) {
      this.updateConnectionNotice();
      this.loadBandwidthChart();

      if (this.conn?.extra_data?.pid !== undefined) {
        this.portapi.get<Process>(`network:tree/${this.conn.extra_data.pid}-${this.conn.extra_data.processCreatedAt}`)
          .subscribe({
            next: p => {
              this.process = p;
              this.cdr.markForCheck();
            },
            error: () => {
              this.process = null; // the process does not exist anymore
              this.cdr.markForCheck();
            }
          })
      } else {
        this.process = null;
      }
    }
  }

  ngOnInit() {
    this._subscription = this.helper.refresh.subscribe(() => {
      this.updateConnectionNotice();
      this.loadBandwidthChart();

      this.cdr.markForCheck();
    })
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  openProcessDetails() {
    this.dialog.create(ProcessDetailsDialogComponent, {
      data: this.process,
      backdrop: true,
      autoclose: true,
    })
  }

  private loadBandwidthChart() {
    this.bwData = [];

    if (!this.conn) {
      this.cdr.markForCheck()

      return;
    }

    this.netquery.connectionBandwidthChart([this.conn!.id], 1)
      .subscribe(result => {
        if (!result[this.conn!.id]?.length) {
          return;
        }

        this.bwData = result[this.conn!.id];

        this.cdr.markForCheck();
      });
  }

  private updateConnectionNotice() {
    this.connectionNotice = '';
    if (!this.conn) {
      return;
    }

    if (this.conn!.verdict === Verdict.Failed) {
      this.connectionNotice = $localize`:@@netquery.notice.failed:Failed with previous settings.`
      return;
    }

    if (IsDenied(this.conn!.verdict)) {
      this.connectionNotice = $localize`:@@netquery.notice.blocked:Blocked by previous settings. Your current settings could decide differently.`;
    } else {
      this.connectionNotice = $localize`:@@netquery.notice.allowed:Allowed by previous settings. Your current settings could decide differently.`;
    }
  }
}
