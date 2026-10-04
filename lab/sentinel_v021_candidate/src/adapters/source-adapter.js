export class SourceAdapter {
  constructor({id,label,authority,mode="fixture"}){Object.assign(this,{id,label,authority,mode});}
  async status(){return {id:this.id,label:this.label,authority:this.authority,mode:this.mode,live:false};}
  async events(){throw new Error("events() must be implemented");}
}
