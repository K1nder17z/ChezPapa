import type { Category, Dish } from '../types/menu.ts'

function dish(
  id: string,
  name: string,
  priceCents: number,
  ingredients: string,
  allergens: string,
  extra?: Pick<Dish, 'supplement'>,
): Dish {
  return { id, name, priceCents, ingredients, allergens, available: true, ...extra }
}

export const categories: Category[] = [
  {
    id: 'entrees',
    title: 'Nos entrées',
    kicker: 'Entrées',
    intro: 'Pour ouvrir le repas.',
    layout: 'editorial',
    dishes: [
      dish('zaalouk', 'Zaalouk', 750, 'Aubergine, tomate, ail, cumin', 'aucun'),
      dish('salade-chef', 'Salade du chef', 750, 'Laitue, tomate, thon, œuf, olives', 'poisson, œuf'),
      dish('salade-marocaine', 'Salade marocaine', 750, 'Tomate, concombre, oignon, persil, citron', 'aucun'),
      dish('salade-thon', 'Salade de thon', 750, 'Thon, tomate, oignon, poivron, olives', 'poisson'),
    ],
  },
  {
    id: 'soupes',
    title: 'Nos soupes',
    kicker: 'Soupes',
    intro: 'Les soupes de la maison.',
    layout: 'feature',
    photo: 'harira',
    dishes: [
      dish('harira', 'Harira', 400, 'Tomate, lentilles, pois chiches, vermicelles', 'gluten, céleri'),
      dish('bissara', 'Bissara', 400, 'Fèves, ail, cumin, huile d’olive', 'aucun'),
      dish('potage-chef', 'Potage du chef', 400, 'Légumes, pomme de terre, bouillon', 'céleri'),
    ],
  },
  {
    id: 'plats',
    title: 'Nos plats',
    kicker: 'Plats',
    intro: 'Tajines et riz.',
    layout: 'feature',
    photo: 'poulet',
    dishes: [
      dish(
        'tajine-viande-pruneaux',
        'Tajine de viande aux pruneaux avec frites',
        1400,
        'Viande, pruneaux, oignon, cannelle, frites',
        'sulfites ; fruits à coque et œuf en supplément',
        { supplement: { label: 'Amandes et œuf en supplément', priceCents: 300 } },
      ),
      dish(
        'tajine-poulet',
        'Tajine poulet, frites et olives',
        1300,
        'Poulet, olives, citron, oignon, frites',
        'sulfites',
      ),
      dish('riz-legumes', 'Riz aux légumes', 750, 'Riz, carotte, petits pois, courgette', 'céleri'),
    ],
  },
  {
    id: 'specialites',
    title: 'Nos spécialités marocaines',
    kicker: 'Spécialités',
    intro: 'Les classiques, sous leur nom.',
    layout: 'editorial',
    dishes: [
      dish('tripes', 'Tripes (douara)', 1100, 'Tripes, pois chiches, tomate, cumin', 'aucun'),
      dish('pied-veau', 'Pied de veau (kar3ine)', 1300, 'Pied de veau, pois chiches, ail, épices', 'aucun'),
      dish('lentilles', 'Lentilles', 600, 'Lentilles, tomate, oignon, cumin', 'aucun'),
      dish('haricots', 'Haricots blancs', 600, 'Haricots blancs, tomate, oignon, cumin', 'aucun'),
    ],
  },
  {
    id: 'couscous',
    title: 'Nos couscous',
    kicker: 'Couscous',
    intro: 'Le plat du partage.',
    layout: 'feature',
    photo: 'couscous',
    dishes: [
      dish('couscous-poulet', 'Couscous poulet', 1300, 'Semoule, poulet, légumes, pois chiches', 'gluten, céleri'),
      dish('couscous-viande', 'Couscous viande', 1500, 'Semoule, viande, légumes, pois chiches', 'gluten, céleri'),
    ],
  },
  {
    id: 'grillades',
    title: 'Nos grillades',
    kicker: 'Grillades',
    intro: 'Cuites au grill.',
    layout: 'feature',
    photo: 'grill',
    dishes: [
      dish('poulet-roti-entier', 'Poulet rôti entier', 2200, 'Poulet, épices', 'aucun'),
      dish('demi-poulet-roti', 'Demi-poulet rôti', 1100, 'Poulet, épices', 'aucun'),
      dish('brochettes-poulet', 'Brochettes de poulet', 1200, 'Poulet, cumin, paprika', 'aucun'),
      dish('brochettes-dinde', 'Brochettes de dinde', 1200, 'Dinde, cumin, paprika', 'aucun'),
      dish('merguez', 'Merguez', 900, 'Agneau, bœuf, paprika, cumin', 'sulfites'),
      dish('brochettes-kefta', 'Brochettes de kefta', 1200, 'Viande hachée, persil, oignon, cumin', 'aucun'),
      dish('cote-agneau', "Côte d'agneau", 2000, 'Agneau, épices', 'aucun'),
    ],
  },
  {
    id: 'snacks',
    title: 'Nos snacks',
    kicker: 'Snacks',
    intro: 'Pour une faim plus rapide.',
    layout: 'editorial',
    dishes: [
      dish('shawarma', 'Shawarma + frites', 800, 'Pain, viande, crudités, sauce, frites', 'gluten, œuf, lait, sésame'),
      dish(
        'hamburger-kefta',
        'Hamburger kefta + frites',
        700,
        'Pain, kefta, salade, sauce, frites',
        'gluten, sésame, œuf, moutarde',
      ),
    ],
  },
  {
    id: 'sauces',
    title: 'Nos sauces snacks',
    kicker: 'Sauces',
    intro: 'À part.',
    layout: 'plain',
    dishes: [
      dish('ketchup', 'Ketchup', 100, 'Tomate, vinaigre, sucre', 'céleri'),
      dish('andalouse', 'Andalouse', 100, 'Mayonnaise, ketchup, épices', 'œuf, moutarde, céleri'),
      dish('mayonnaise', 'Mayonnaise', 100, 'Œuf, huile, moutarde', 'œuf, moutarde'),
      dish('samourai', 'Samouraï', 100, 'Mayonnaise, harissa, épices', 'œuf, moutarde'),
      dish('ail', 'Ail', 100, 'Ail, mayonnaise', 'œuf, moutarde, lait'),
    ],
  },
  {
    id: 'frites',
    title: 'Nos frites',
    kicker: 'Frites',
    intro: 'En accompagnement.',
    layout: 'feature',
    photo: 'frites',
    dishes: [
      dish('frites-grande', 'Grande portion de frites', 300, 'Pommes de terre', 'aucun'),
      dish('frites-petite', 'Petite portion de frites', 200, 'Pommes de terre', 'aucun'),
    ],
  },
  {
    id: 'boissons-froides',
    title: 'Nos boissons froides',
    kicker: 'Boissons froides',
    intro: 'Servies fraîches.',
    layout: 'columns',
    dishes: [
      dish('coca-cola', 'Coca-Cola', 150, 'Boisson gazeuse', 'aucun'),
      dish('coca-cola-zero', 'Coca-Cola Zero', 150, 'Boisson gazeuse sans sucre', 'aucun'),
      dish('fanta', 'Fanta', 150, 'Boisson gazeuse à l’orange', 'aucun'),
      dish('schweppes', 'Schweppes', 150, 'Boisson gazeuse', 'aucun'),
      dish('sprite', 'Sprite', 150, 'Boisson gazeuse citron-lime', 'aucun'),
      dish('oasis', 'Oasis', 150, 'Boisson aux fruits', 'aucun'),
      dish('eau-petillante', 'Eau pétillante', 150, 'Eau gazéifiée', 'aucun'),
      dish('eau-plate', 'Eau plate', 150, 'Eau', 'aucun'),
    ],
  },
  {
    id: 'boissons-chaudes',
    title: 'Boissons chaudes',
    kicker: 'Boissons chaudes',
    intro: 'Le thé et le café.',
    layout: 'feature',
    photo: 'tea',
    dishes: [
      dish('the-marocain', 'Thé marocain', 200, 'Thé vert, menthe, sucre', 'aucun'),
      dish('cafe', 'Café', 200, 'Café', 'aucun'),
    ],
  },
  {
    id: 'desserts',
    title: 'Nos desserts',
    kicker: 'Desserts',
    intro: 'Pour finir.',
    layout: 'editorial',
    dishes: [
      dish('tiramisu', 'Tiramisu', 250, 'Mascarpone, biscuits, œufs, café', 'gluten, œuf, lait'),
    ],
  },
]

export function allDishes(): Array<Dish & { categoryId: string; categoryTitle: string }> {
  return categories.flatMap((category) =>
    category.dishes.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryTitle: category.title,
    })),
  )
}
