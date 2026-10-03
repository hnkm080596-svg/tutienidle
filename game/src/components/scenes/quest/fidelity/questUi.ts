export interface QuestDisplay {
  id:string
  name:string
  status:'active'|'ready'|'claimed'
  description:string
  image:string
  objectives:readonly {id:string;label:string;value:string;done:boolean}[]
}
