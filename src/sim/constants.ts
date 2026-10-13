export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const BAY_COUNT = 6;

/** Time for a truck to drive in from the road and reverse onto its bay. */
export const ARRIVE_DUR = 16 * SEC;
/** Time to pull off the bay and leave the site. */
export const DEPART_DUR = 12 * SEC;
/** Dock handling time per pallet (loading or unloading). */
export const HANDLE_PER_PALLET = 3 * SEC;
/** Keep this many trucks scheduled or on site per hub. */
export const PIPELINE_TARGET = 6;
/** How long finished trucks/shipments stay in the lists. */
export const RETAIN_DONE = 8 * MIN;
export const MAX_EVENTS = 40;
/** One forklift moves a putaway pallet in this long. */
export const PUTAWAY_PER_PALLET = 2.5 * SEC;

export const CARRIERS = ['Hubline Fleet', 'Bluepeak Freight', 'Coastline Haulage', 'Ridgeway Logistics'] as const;
export const CUSTOMERS = [
  'Northwind Retail',
  'Blue Pine Grocers',
  'Atlas Hardware',
  'Kestrel Pharma',
  'Summit Outfitters',
  'Oakline Home',
  'Cobalt Electronics',
  'Meridian Foods',
] as const;
export const DESTINATIONS = [
  'Philadelphia, PA',
  'Boston, MA',
  'Hartford, CT',
  'Pittsburgh, PA',
  'Richmond, VA',
  'Albany, NY',
  'Wilmington, DE',
  'Providence, RI',
  'Scranton, PA',
  'Trenton, NJ',
] as const;
export const DRIVERS = [
  'Marcus Reed',
  'Priya Nair',
  'Tom Alvarez',
  'Jenna Brooks',
  'Omar Haddad',
  'Lena Fischer',
  'Diego Santos',
  'Grace Liu',
  'Sam Okafor',
  'Nadia Petrova',
] as const;
export const OPERATORS = [
  'R. Patel',
  'K. Morgan',
  'J. Kim',
  'L. Rossi',
  'A. Mensah',
  'D. Walsh',
  'S. Tanaka',
  'M. Costa',
] as const;
export const STATES = ['NJ', 'PA', 'NY', 'MD', 'DE'] as const;
