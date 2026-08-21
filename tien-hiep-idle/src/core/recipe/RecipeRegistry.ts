import type { Recipe } from './Recipe'

export class RecipeRegistry {
  private readonly recipes = new Map<string, Recipe>()

  register(recipe: Recipe): void {
    if (this.recipes.has(recipe.id)) {
      throw new Error(`Recipe already registered: ${recipe.id}`)
    }

    this.recipes.set(recipe.id, recipe)
  }

  get(recipeId: string): Recipe {
    const recipe = this.recipes.get(recipeId)

    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`)
    }

    return recipe
  }

  has(recipeId: string): boolean {
    return this.recipes.has(recipeId)
  }

  getAll(): Recipe[] {
    return Array.from(this.recipes.values())
  }
}
