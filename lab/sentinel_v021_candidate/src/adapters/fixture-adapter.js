import {SourceAdapter} from './source-adapter.js';
import {fixtures} from '../../fixtures/events.js';
export class FixtureAdapter extends SourceAdapter {
  constructor(){super({id:'fixture-v0',label:'Sentinel V0 fixtures',authority:'NONE — synthetic/user-reported fixtures',mode:'fixture'});}
  async events(){return structuredClone(fixtures.events);}
  async watch(){return structuredClone(fixtures.watch);}
}
