import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';

import 'object-assign';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/startWith';
import 'rxjs/add/operator/switchMap';

import { AlertsService } from '../alerts/alerts';
import { AssetsService } from '../assets/assets';

export class Blueprint {
  name: string;
  provisioner: string; //Provisioner type (docker/...)
  stages: Object[];
  state: string;
  type: string; //Type of blueprint (pipeline/application)
  version: string;
  ui: {
    stagesStatesBages: {};
  };
  id: string;
}

@Injectable()
export class APIService {

  private blueprints: Observable<Blueprint[]>;
  private blueprintsInterval = this.assetsService.asset('timers').blueprintsInterval;
  private blueprintsUrl = this.assetsService.asset('api').blueprintsUrl;

  constructor(
    private alertsService: AlertsService,
    private assetsService: AssetsService,
    private http: Http
  ) {

    this.blueprints = Observable
      .interval(this.blueprintsInterval)
      .startWith(0)
      .switchMap(() => this.http.get(this.blueprintsUrl))
      .map(this.extractJSONAPI)
      .map(this.extendBlueprintsData)
      .share()
      .catch(error => this.handleError(error, '#APIService.getBlueprints,#Error'));

  }

  private extendBlueprintsData(bps: {}) {
    let stagesStatesBages = {};
    let filters = {
      green: ['running'],
      orange: ['new', 'created'],
      grey: ['deleted', 'paused', 'stopped'],
    };
    for (let f in filters) {
      stagesStatesBages[f] = 0;
    }

    for (let i in bps) {
      let bp = bps[i]
      bp.ui = {
        stagesStatesBages: Object.assign({}, stagesStatesBages)
      }

      for (let s in bp.stages) {
        for (let f in filters) {
          if (filters[f].indexOf(bp.stages[s].state) > -1) {
            bp.ui.stagesStatesBages[f]++;
            break;
          }
        }
      }
    }
    return bps;
  }

  private extractJSONAPI(res: Response) {
    /* TODO: wrap and use jsonapi-serializer promise
        var JSONAPIDeserializer = require('jsonapi-serializer').Deserializer;
        var p = new JSONAPIDeserializer().deserialize(res.json(), function(err: any, data: {}) {
          console.log('#JSONAPIDeserializer', data);
        });
        console.log('#JSONAPIDeserializer,#p', p, Observable.fromPromise(p));
    */
    let _ = require('lodash');

    function isComplexType(obj: any) {
      return _.isArray(obj) || _.isPlainObject(obj);
    }

    function keyForAttribute(attribute: any) {
      if (_.isPlainObject(attribute)) {
        return _.transform(attribute, function(result: any, value: any, key: any) {
          if (isComplexType(value)) {
            result[keyForAttribute(key)] = keyForAttribute(value);
          } else {
            result[keyForAttribute(key)] = value;
          }
        });
      } else if (_.isArray(attribute)) {
        return attribute.map(function(attr: any) {
          if (isComplexType(attr)) {
            return keyForAttribute(attr);
          } else {
            return attr;
          }
        });
      } else {
        // original calls to inflection here
        return attribute;
      }
    }

    function extractAttributes(from: any) {
      var dest = keyForAttribute(from.attributes || {});
      if ('id' in from) { dest.id = from.id; }
      return dest;
    }

    let data = res.json().data;
    if (Array.isArray(data)) {
      for (let i in data) {
        data[i] = extractAttributes(data[i]);
      }
    } else {
      data = extractAttributes(data);
    }
    return data;
  }

  private handleError(error: any, logTags?: string) {
    console.error(logTags ? logTags : '#APIService,#Error', error);
    // handle JSONAPI Errors
    try {
      let o = error.json()
      if (o && o.errors) {
        for (let i in o.errors) {
          this.alertsService.alertError(o.errors[i].details);
        }
      }
    } catch (e) {
      this.alertsService.alertError();
    }

    return Observable.throw(error);
  }

  /**
    @description Returns the Observable that repeats the XHR while subscribed.
   */
  getBlueprints(): Observable<Blueprint[]> {
    return this.blueprints;
  }

}
