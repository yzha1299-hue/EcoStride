export function validateSuburb(value) {
  const suburb = value.trim()

  if (!suburb) {
    return 'Please enter a suburb.'
  }

  if (!/^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/.test(suburb)) {
    return 'Suburb must contain letters only.'
  }

  return ''
}

export function validatePostcode(value) {
  const postcode = value.trim()

  if (!postcode) {
    return 'Please enter a postcode.'
  }

  if (!/^\d+$/.test(postcode)) {
    return 'Postcode must contain numbers only.'
  }

  if (postcode.length !== 4) {
    return 'Postcode must be exactly 4 digits.'
  }

  return ''
}
