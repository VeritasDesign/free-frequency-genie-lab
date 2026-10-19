import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
const root=new URL('./',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const task=read('components/ReceiverTask.brs');
const xml=read('components/ReceiverTask.xml');
const scene=read('components/HomeScene.brs');
const manifest=read('manifest');

assert.match(xml,/<component name="ReceiverTask" extends="Task">/);
assert.match(xml,/<field id="enabled" type="boolean" value="false"/);
for(const field of ['endpoint','receiverId','receiverToken','command','connectionState']) {
  assert.match(xml,new RegExp('<field id="'+field+'"'));
}
assert.match(task,/Left\(endpoint, 8\) <> "https:\/\/"/);
assert.match(task,/AddHeader\("Authorization", "Bearer " \+ receiverToken\)/);
assert.match(task,/candidate\.commandId > afterId/);
assert.match(task,/ABCDEFGHIJKLMNOPQRSTUVWXYZ/);
assert.match(task,/response\.GetResponseCode\(\) = 200/);
assert.match(task,/Sleep\(delayMs\)/);
assert.match(scene,/playSample\(\)/);
assert.match(manifest,/minor_version=2/);
assert.doesNotMatch(scene,/ReceiverTask/);
const lines=task.split(/\r?\n/).map(line=>line.trim().toLowerCase()).filter(line=>!line.startsWith("'"));
let stack=[];
for(const line of lines){
 if(/^if\b.*\bthen$/.test(line))stack.push('if');
 if(/^while\b/.test(line))stack.push('while');
 if(line==='end if')assert.equal(stack.pop(),'if','if nesting mismatch');
 if(line==='end while')assert.equal(stack.pop(),'while','while nesting mismatch');
}
assert.equal(stack.length,0,'unclosed block');
console.log('PASS: Roku receiver source invariants, block nesting and v0.2 isolation');
