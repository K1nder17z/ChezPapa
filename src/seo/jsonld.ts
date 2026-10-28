import { restaurant } from '../config/restaurant.ts'
import { categories } from '../data/menu.ts'

export function buildRestaurantJsonLd(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    servesCuisine: 'Cuisine marocaine',
    hasMenu: {
      '@type': 'Menu',
      name: 'Carte Chez Papa',
      hasMenuSection: categories.map((category) => ({
        '@type': 'MenuSection',
        name: category.title,
          hasMenuItem: category.dishes.map((dish) => ({
          '@type': 'MenuItem',
          name: dish.name,
          description: [
            `${dish.ingredients}. Allergènes : ${dish.allergens}.`,
            dish.supplement
              ? `${dish.supplement.label} : +${(dish.supplement.priceCents / 100).toFixed(2)} EUR.`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
          offers: {
            '@type': 'Offer',
            price: (dish.priceCents / 100).toFixed(2),
            priceCurrency: 'EUR',
          },
        })),
      })),
    },
  }

  if (restaurant.publicMenuUrl) node.url = restaurant.publicMenuUrl
  if (restaurant.address) node.address = restaurant.address
  if (restaurant.phone) node.telephone = restaurant.phone

  return node
}
