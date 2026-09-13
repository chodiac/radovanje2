/* ============================================================
   SALA RADOVANJE — IMAGE REGISTRY
   ------------------------------------------------------------
   ADDING THE REAL PHOTOGRAPHS

   Option A — recommended, no code changes
     1. Drop files into /images named after the placeholder slug:
            images/hero-image.webp
            images/gallery-01.webp
            images/sky-object.png      <- transparent object
        Optionally add @2x variants:  images/hero-image@2x.webp
     2. Run once:   python tools/build-manifest.py
        That writes images/manifest.json and the page picks the
        files up on the next reload — zero requests wasted.

   Option B — explicit paths / hand-tuned art direction
     Add entries to MAP below. A string is a plain src; an object
     may carry { src, srcset, sizes, position }:
         'hero-image': {
            src:    'images/hero/hero-2400.jpg',
            srcset: 'images/hero/hero-1200.jpg 1200w, ' +
                    'images/hero/hero-2400.jpg 2400w',
            sizes:  '100vw',
            position: '50% 35%'          // object-position
         }
     MAP always wins over the manifest.

   Option C — no build step at all
     Set PROBE: true. The page then tries each extension in
     EXTENSIONS for every slug. Convenient, but it costs one
     failed request per miss (visible in the console), so prefer
     Option A for anything public.

   Slug list: see SLUGS at the bottom — it mirrors every
   data-ph="…" attribute in index.html.
   ============================================================ */
/* ============================================================
   SALA RADOVANJE — IMAGE REGISTRY
   ============================================================ */

window.SR_IMAGES = {

  // Folder u kome se nalaze slike
  DIR: 'images/',

  // Ne koristimo manifest jer slike unosimo ručno
  MANIFEST: false,

  // Ne pokušava automatski druge ekstenzije
  PROBE: false,

  EXTENSIONS: ['png'],

  // ==========================================================
  // SLIKE
  // ==========================================================
  MAP: {

    // HERO / NASLOVNA
    'hero-image': 'images/naslovna.webp',

    // O NAMA
    'venue-exterior': 'images/prostor.webp',

    // STATISTIKA
    'stats-bg': 'images/prostor4.webp',

    // DOGAĐAJI
    'event-vencanja': 'images/mladenci.webp',
    'event-rodjendani': 'images/rodjendan.webp',
    'event-proslave': 'images/prostor3.webp',
    'event-poslovni': 'images/prostor2.webp',
    'event-krstenja': 'images/rodjendan3.webp',
    'event-banketi': 'images/koktel.webp',

    // DODATNE FOTOGRAFIJE DOGAĐAJA
    'wedding-01': 'images/mladenci.webp',
    'celebration-01': 'images/rodjendan2.webp',

    // DEKORATIVNA SLIKA
    'sky-object': 'images/dekoracija2.webp',

    // GLAVNA SALA
    // 'hall-intro' je prvi kadar (eksterijer s nebom) koji se
    // pretapa u 'hall-main' (unutrašnjost) tokom skrola
    'hall-intro': 'images/naslovna.webp',
    'hall-main': 'images/prostor4.webp',

    // APARTMANI
    'apartment-01': 'images/krevet.webp',
    'apartment-02': 'images/krevet2.webp',
    'apartment-03': 'images/krevet3.webp',

    // GALERIJA
    'gallery-01': 'images/prostor.webp',
    'gallery-02': 'images/prostor2.webp',
    'gallery-03': 'images/dekoracija3.webp',
    'gallery-04': 'images/prostor4.webp',
    'gallery-05': 'images/dekoracija.webp',
    'gallery-06': 'images/koktel.webp',
    'gallery-07': 'images/mladenci.webp',

    // DETALJI
    'detail-detalji': 'images/dekoracija2.webp',
    'detail-ambijent': 'images/prostor3.webp',
    'detail-dekoracija': 'images/dekoracija.webp',
    'detail-rasveta': 'images/dekoracija3.webp',
    'detail-atmosfera': 'images/rodjendan2.webp',

    // POZADINA ZA CITAT
    'quote-bg': 'images/prostor4.webp',

    // POSLEDNJA SEKCIJA
    'final-venue': 'images/naslovna.webp'
  },

  // Placeholderi koje sajt koristi
  SLUGS: [
    'hero-image',
    'venue-exterior',
    'stats-bg',

    'event-vencanja',
    'event-rodjendani',
    'event-proslave',
    'event-poslovni',
    'event-krstenja',
    'event-banketi',

    'wedding-01',
    'celebration-01',

    'sky-object',

    'hall-main',

    'apartment-01',
    'apartment-02',
    'apartment-03',

    'gallery-01',
    'gallery-02',
    'gallery-03',
    'gallery-04',
    'gallery-05',
    'gallery-06',
    'gallery-07',

    'detail-detalji',
    'detail-ambijent',
    'detail-dekoracija',
    'detail-rasveta',
    'detail-atmosfera',

    'quote-bg',
    'final-venue'
  ]
};
