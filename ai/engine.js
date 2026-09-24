(function(root){
'use strict';
class CommentaryModel{
 constructor(data){this.data=data;}
 predict(text){
  const d=this.data,tokens=String(text).toLowerCase().match(/(?<![\p{L}\p{N}_])[a-z0-9][a-z0-9]+(?![\p{L}\p{N}_])/gu)||[];
  const counts=new Map(),add=w=>{const i=d.vocabulary[w];if(Number.isInteger(i))counts.set(i,(counts.get(i)||0)+1);};
  tokens.forEach(add);for(let i=0;i<tokens.length-1;i++)add(tokens[i]+' '+tokens[i+1]);
  let norm=0;const features=[];for(const [i,n] of counts){const v=(1+Math.log(n))*d.idf[i];features.push([i,v]);norm+=v*v;}norm=Math.sqrt(norm)||1;
  const logits=d.intercepts.map((b,k)=>features.reduce((s,[i,v])=>s+d.coefficients[k][i]*v/norm,b));
  const mx=Math.max(...logits),exp=logits.map(x=>Math.exp(x-mx)),sum=exp.reduce((a,b)=>a+b,0),values=exp.map(x=>x/sum),best=values.indexOf(Math.max(...values));
  return {label:d.classes[best],score:values[best],scores:Object.fromEntries(d.classes.map((c,i)=>[c,values[i]])),hasFeatures:features.length>0,eligible:false,pattern:[]};
 }
}
async function load(url='ai/model.json'){const r=await fetch(url);if(!r.ok)throw Error('Model unavailable ('+r.status+')');return new CommentaryModel(await r.json());}
const api={CommentaryModel,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.KoraVibeAI=api;
})(typeof window!=='undefined'?window:globalThis);
