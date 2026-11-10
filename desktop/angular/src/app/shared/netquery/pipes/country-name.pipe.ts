import { HttpClient } from '@angular/common/http';
import { Pipe, PipeTransform, Injectable, LOCALE_ID, inject } from '@angular/core';
import { GeoCoordinates, SPNService } from '@safing/portmaster-api';
import { environment } from 'src/environments/environment';
import { ActionIndicatorService } from '../../action-indicator';
import { objKeys } from '../../utils';
import { getCountryName } from './country-name';

export interface CountryListResponse {
  [countryKey: string]: {
    Code: string;
    Name: string;
    Center: GeoCoordinates;
    Continent: {
      Code: string;
      Region: string;
      Name: string;
    }
  }
}

@Injectable()
export class CountryNameService {
  private readonly spn = inject(SPNService);
  private readonly http = inject(HttpClient);
  private readonly uai = inject(ActionIndicatorService);
  private readonly localeId = inject(LOCALE_ID);

  private map: Map<string, string> = new Map();

  constructor() {
    this.http.get<CountryListResponse>(`${environment.httpAPI}/v1/intel/geoip/countries`)
      .subscribe({
        next: response => {
          objKeys(response)
            .forEach(key => {
              this.map.set(key as string, response[key].Name);
            });
        },
        error: err => {
          this.uai.error($localize`:@@netquery.countryDataFailed:Failed to fetch country data`, this.uai.getErrorMessage(err));
        }
      })
  }

  resolveName(code: string): string {
    return getCountryName(code, this.map.get(code) || code, this.localeId);
  }
}

@Pipe({
  name: 'countryName',
  pure: true,
})
export class CountryNamePipe implements PipeTransform {
  private countryService = inject(CountryNameService);

  transform(countryCode: string) {
    return this.countryService.resolveName(countryCode);
  }
}
