from pathlib import Path
import json

raise SystemExit('Archived 23-source generator. Use game/scripts/build-tien-hiep-ui.mjs; this file must not overwrite the current pack.')

doc = Path(__file__).resolve().parent
root = doc.parents[2]
out = root / 'public/assets/ui/tien-hiep-2026-10'
metrics = json.loads((doc/'source-metrics.json').read_text())
mapping = {
'frame-xs-tooltip':'panel-frame','frame-s-slot':'slot-frame','surface-m-panel':'panel-frame',
'frame-m-modal':'panel-frame','surface-l-drawer':'panel-frame','surface-xl-scroll':'page-frame',
'frame-xl-ceremony':'page-frame','button-compact':'button-secondary','button-standard':'button-secondary',
'button-ceremonial':'button-primary','icon-button-utility':'orb-frame','seal-chip':'tab-plate',
'resource-pill':'resource-pill','entity-bar':'progress-track','divider-ornament':'divider',
'scrollbar':'progress-track','dao-luan-center':'orb-frame','dao-luan-node':'orb-frame','rune-node':'orb-frame',
'tab-seal':'tab-plate','imperial-scroll-body':'page-frame','imperial-scroll-roller':None,
'scroll-title-plaque':'title-plaque','section-plaque':'section-header','nav-seal-vertical':'building-plaque',
'list-row':'list-row','avatar-frame':'avatar-ring','identity-plate':'identity-plate',
'text-field':'text-field','toggle-track':'progress-track','slider-track':'progress-track','slider-thumb':'orb-frame',
'skill-orb-frame':'orb-frame','turn-token':'orb-frame','boss-seal':'building-plaque','stage-node':'orb-frame',
'building-plaque':'building-plaque','corner-ornament':None,'cloud-ornament':None,
'timer-ring':'orb-frame','ceremony-ribbon':'ceremony-ribbon','paper-grain-tile':'paper-surface',
'alchemy-cauldron-prop':None}
frames={'page-frame':(.28,.28,.29,.29,60),'panel-frame':(.20,.20,.20,.20,24),
        'slot-frame':(.26,.26,.26,.26,14),'navigation-rail':(.2,.2,.18,.18,30)}
horizontal={'button-primary','button-secondary','title-plaque','resource-pill','identity-plate',
            'section-header','tab-plate','progress-track','list-row','text-field',
            'ceremony-ribbon','ceremony-ribbon-red','power-ribbon','divider'}
entries=[]
for m in metrics:
    asset=dict(id=m['id'],url='/assets/ui/tien-hiep-2026-10/source/'+m['id']+'.png',
               sourceSize=dict(width=m['width'],height=m['height']),sourceRect=m['bounds'],
               alpha=dict(min=m['alphaMin'],max=m['alphaMax'],center=m['centerAlpha']),
               tintable=False,status='art-delivered',
               safeRectNormalized=dict(x=.20,y=.20,width=.60,height=.60),
               replaces=[k for k,v in mapping.items() if v==m['id']])
    if m['id'] in frames:
        l,r,t,b,d=frames[m['id']]; br=m['bounds']
        asset.update(render='nine-slice-source-rect',center='fill' if m['id']=='navigation-rail' else 'transparent',
                     slices=dict(left=round(br['width']*l),right=round(br['width']*r),
                                 top=round(br['height']*t),bottom=round(br['height']*b)),
                     destinationBorder=d)
    elif m['id']=='world-vista':
        asset.update(render='cover',center='fill',safeRectNormalized=dict(x=0,y=0,width=1,height=1),
                     role='decorative UI backdrop; keep live building props/hotspots separate')
    elif m['id']=='world-vista':
        asset.update(render='cover',center='fill',safeRectNormalized=dict(x=0,y=0,width=1,height=1))
    elif m['id']=='paper-surface':
        asset.update(render='tile',center='fill',safeRectNormalized=dict(x=0,y=0,width=1,height=1))
    elif m['id'] in horizontal:
        asset.update(render='three-slice-source-rect',capFraction=.22,center='fill',
                     safeRectNormalized=dict(x=.23,y=.18,width=.54,height=.64))
    else:
        asset.update(render='contain-source-rect',center='transparent' if m['centerAlpha']==0 else 'fill')
    entries.append(asset)
pack=dict(version=1,baseline='f8af8007b0b6519e6aa6997fedad2cc77939538a',
          branch='codex/hoa-cau-fireball-vfx',scope='UI art authoring only; no production wiring',
          sourceRectThreshold=8,assets=entries,legacyMapping=mapping,
          preserved=['existing logo','existing animated characters','existing world/building art',
                     'existing item and skill icons','SVG functional symbols','alchemy-cauldron-prop'],
          suppressed=['imperial-scroll-roller','corner-ornament','cloud-ornament'],
          warning='Do not copy old nine-slice values. All crop/slice units are source pixels. Preview is art evidence, not production-runtime evidence.')
(out/'pack.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(entries)} assets; {len(mapping)} old registry entries accounted for')

