export interface QuestDisplay {
  id:string
  name:string
  status:'active'|'ready'|'claimed'
  description:string
  image:string
  /** Thematic group id (the landscape preview's group axis) - the
      fallback rail buckets missing groups under 'all'. */
  group?:string
  objectives:readonly {id:string;label:string;value:string;done:boolean}[]
  /** Counted progress for the EnergyTube rows (done/total). */
  progress?:number
  progressText?:string
}
