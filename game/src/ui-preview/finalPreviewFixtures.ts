import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type {InventoryDisplay} from '@/components/scenes/inventory/fidelity/inventoryUi'
import type {QuestDisplay} from '@/components/scenes/quest/fidelity/questUi'
export function inventoryFixtures(t:(key:string)=>string):InventoryDisplay[] {
 const specs=[['ore','material','/assets/materials/linh_khoang.png'],['wood','material','/assets/materials/linh_moc.png'],['pill','pill','/assets/pills/tu_linh_dan.png'],['herb','material','/assets/materials/herbs/tu_linh_thao/decade.png'],['sword','equipment','/assets/equipment/items/base-kiem/kiem-01.png'],['robe','equipment','/assets/equipment/items/base-bao/bao-01.png'],['ring','equipment','/assets/equipment/items/base-gioi/gioi-01.png']] as const
 return Array.from({length:28},(_,i)=>{const s=specs[i%7]!;return {id:`item-${i}`,name:t(`items.${s[0]}`),category:s[1],icon:resolveAssetUrl(s[2]),amount:s[1]==='equipment'?'1':String(12+i*3),description:t('inventoryPreview.description')}})
}
export function questFixtures(t:(key:string)=>string):QuestDisplay[] {
 return ['mountain','herb','training','beasts','path'].map((id,i)=>({id,name:t(`questPreview.names.${id}`),status:i===1?'ready':i===4?'claimed':'active',description:t('questPreview.description'),image:resolveAssetUrl('/assets/ui/huyen-kim/scene/dong-fu-v2/rear.png'),objectives:['visit','talk','explore'].map((key,n)=>({id:key,label:t(`questPreview.objective.${key}`),value:i===1||i===4||n===0?'1 / 1':'0 / 1',done:i===1||i===4||n===0}))}))
}
