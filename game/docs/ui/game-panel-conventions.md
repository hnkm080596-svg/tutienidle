# Game panel instances

The rail surfaces use `GamePanel.vue` as their actual parent panel. Its
root class is `game-panel`; the default slot mounts inside
`game-panel__content`, rather than beside a decorative background.

The panel owns the 1065 by 608 design rectangle, backdrop, title,
separator line and content bounds. Detail is inset 10px from the left, right
and bottom; its top starts 10px below the separator. The decorative title
divider is removed. `SceneDesignCanvas` owns viewport scaling.
The full-canvas `rail-panel-scene` wrapper is click-through. Only the bounded
`game-panel` opts into pointer input. Scene instances do not override this
policy, and global reskin packs do not maintain lists of panel names for it.
Content coordinates start at the content rectangle's origin. Each scene owns
its columns, grids and placement through scoped styles. Shared panel CSS must
not contain feature selectors or gameplay decisions.

| Class | Responsibility |
| --- | --- |
| `game-panel` | Parent backdrop, dimensions and stacking context |
| `game-panel__header` | Header region |
| `game-panel__title` | Localized title supplied by the caller |
| `game-panel__line` | Separator at the approved raised position |
| `game-panel__content` | Rectangular containing block for scene instances |
| `game-panel__stack` | Vertical content layout |
| `game-panel__toolbar` / `game-panel__tabs` | Local actions or tabs |
| `game-panel__workspace` | Remaining flexible content region |
| `game-panel__card` | Instance marker for GameCard; its appearance belongs to GameCard |
| `game-panel__button` | Interaction convention; button art and variants remain component-owned |

The historical global reskin packs use `@scope (:root) to (.game-panel)`:
their selectors stop at the panel boundary. Design tokens still inherit from
the application. Local component styling controls the panel interior; adding
another `#app` selector or `!important` to defeat an old reskin is not the
instance contract. Modal confirmations and combat surfaces retain their own
containers.

Commands, selection, domain queries, focus management and close behavior stay
with their existing owners. Slots move the rendered instances, not their
gameplay authority.

Components are the smallest UI units. `GameCard.vue` owns its frame and dark
translucent fill, independently of any panel. `GamePanel` owns its own
backdrop/title/line. Their relationship manages placement and available size;
it must not override another component's art, fill or interaction state.
Feature slot content keeps its own typography and controls. `EquipmentArtCard`
is a forwarding adapter to the same GameCard implementation.
