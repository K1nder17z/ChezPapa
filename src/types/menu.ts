export type Supplement = {
  label: string
  priceCents: number
}

export type Dish = {
  id: string
  name: string
  priceCents: number
  ingredients: string
  allergens: string
  available: boolean
  supplement?: Supplement
}

export type PhotoId =
  | 'harira'
  | 'couscous'
  | 'poulet'
  | 'grill'
  | 'tea'
  | 'frites'
  | 'entrees'
  | 'snacks'
  | 'specialites'
  | 'tiramisu'

export type CategoryLayout = 'feature' | 'editorial' | 'plain' | 'columns'

export type Category = {
  id: string
  title: string
  kicker: string
  intro?: string
  layout: CategoryLayout
  photo?: PhotoId
  dishes: Dish[]
}
