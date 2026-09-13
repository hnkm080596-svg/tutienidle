/**
 * The turn token. Only one exists per battle. It is the sole authority on
 * whether combat is between turns or inside one. Everything the clock needs
 * to know about turns is derived from this state machine; nothing else in the
 * engine is allowed to keep a parallel "in flight" flag.
 */

export type TokenState =
  | 'IDLE'
  | 'CLAIMED'
  | 'AWAITING_INPUT'
  | 'RESOLVING'
  | 'COMBAT_OVER'

export interface ClaimArgs {
  actorId: string
  isPlayerTeam: boolean
  manualMode: boolean
}

export interface ResolveArgs {
  bothSidesAlive: boolean
}

export class TurnToken {
  private state: TokenState = 'IDLE'
  private readonly listeners = new Set<(state: TokenState) => void>()

  getState(): TokenState {
    return this.state
  }

  claim(args: ClaimArgs): void {
    if (this.state !== 'IDLE') {
      throw new Error(`Cannot claim turn token while state is ${this.state}, not IDLE`)
    }

    this.setState('CLAIMED')

    if (args.isPlayerTeam && args.manualMode) {
      this.setState('AWAITING_INPUT')
    } else {
      this.setState('RESOLVING')
    }
  }

  submitChoice(): void {
    if (this.state !== 'AWAITING_INPUT') {
      throw new Error(`Cannot submit choice while state is ${this.state}`)
    }

    this.setState('RESOLVING')
  }

  resolve(args: ResolveArgs): void {
    if (this.state !== 'RESOLVING') {
      throw new Error(`Cannot resolve while state is ${this.state}`)
    }

    this.setState(args.bothSidesAlive ? 'IDLE' : 'COMBAT_OVER')
  }

  /**
   * Returns the token to IDLE. Called by startStage (spec 3.3) — without
   * this, a battle that ended in COMBAT_OVER leaves a terminal token for the
   * next battle, whose first claim() is then rejected and which never starts.
   */
  reset(): void {
    this.setState('IDLE')
  }

  onStateChange(listener: (state: TokenState) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(next: TokenState): void {
    this.state = next

    for (const listener of this.listeners) {
      listener(next)
    }
  }
}
