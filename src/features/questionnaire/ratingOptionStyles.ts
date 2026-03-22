export type RatingOptionPalette = 'gold' | 'blue' | 'coral'

export function getRatingOptionClasses(
  isSelected: boolean,
  palette: RatingOptionPalette = 'gold'
) {
  return [
    'rating-option',
    `rating-option--${palette}`,
    ...(isSelected ? ['rating-option--selected'] : [])
  ]
}
