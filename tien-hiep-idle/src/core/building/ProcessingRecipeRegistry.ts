import type { ProcessingRecipe } from './ProcessingRecipe'

export class ProcessingRecipeRegistry {
  private readonly recipes = new Map<string, ProcessingRecipe>()

  register(recipe: ProcessingRecipe): void {
    if (this.recipes.has(recipe.id)) {
      throw new Error(`ProcessingRecipe already registered: ${recipe.id}`)
    }

    this.recipes.set(recipe.id, recipe)
  }

  get(recipeId: string): ProcessingRecipe {
    const recipe = this.recipes.get(recipeId)

    if (!recipe) {
      throw new Error(`ProcessingRecipe not found: ${recipeId}`)
    }

    return recipe
  }

  has(recipeId: string): boolean {
    return this.recipes.has(recipeId)
  }

  getAll(): ProcessingRecipe[] {
    return Array.from(this.recipes.values())
  }
}
