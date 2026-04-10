export type Locale = "de" | "en";

export const translations = {
  de: {
    // Navigation
    nav: {
      overview: "Übersicht",
      trips: "Reisen",
      newTrip: "Neue Reise",
      admin: "Genehmigungen",
      analytics: "Analytics",
      settings: "Einstellungen",
      administration: "Administration",
      signOut: "Abmelden",
    },
    // Dashboard
    dashboard: {
      greeting: "Guten Tag",
      subtitle: "Reisekostenübersicht",
      newTrip: "Neue Reise",
      allTrips: "Alle Reisen",
      recentTrips: "Letzte Reisen",
      showAll: "Alle anzeigen",
      noTrips: "Noch keine Reisen erfasst",
      noTripsHint: "Starten Sie mit Ihrer ersten Dienstreise",
      startFirstTrip: "Erste Reise anlegen",
      mileageCap: "Kilometergeld-Jahresgrenze",
      remaining: "km verbleibend à €0,50",
      exhausted: "ausgeschöpft",
      limitReached: "Jahresgrenze erreicht — weitere Kilometer werden mit €0 erstattet",
    },
    // KPIs
    kpi: {
      taxFree: "Steuerfrei genehmigt",
      taxFreeHint: "Taggeld + Kilometergeld",
      taxable: "KV-Überschuss",
      taxableHint: "Steuerpflichtiger Anteil",
      pending: "Ausstehend",
      pendingHint: "Reisen zur Genehmigung",
      total: "Gesamt Reisen",
      totalHint: "inkl. Entwürfe",
      approved: "genehmigt",
    },
    // Trips list
    trips: {
      title: "Meine Reisen",
      recorded: "erfasst",
      trip: "Reise",
      trips: "Reisen",
      filterAll: "Alle",
      filterDraft: "Entwurf",
      filterPending: "Ausstehend",
      filterApproved: "Genehmigt",
      filterRejected: "Abgelehnt",
      searchPlaceholder: "Zielort oder Reisezweck suchen…",
      noResults: "Keine Ergebnisse für",
      noResultsHint: "Versuchen Sie einen anderen Suchbegriff",
      noTrips: "Keine Reisen vorhanden",
      noTripsHint: "Beginnen Sie mit der Erfassung Ihrer ersten Dienstreise",
      startFirst: "Erste Reise erfassen",
      taxFree: "steuerfrei",
    },
    // Trip detail
    tripDetail: {
      back: "Zurück",
      travelData: "Reisedaten",
      calculation: "Berechnung §26 EStG",
      receipts: "Belege",
      departure: "Abreise",
      return: "Rückkehr",
      duration: "Dauer",
      kilometers: "Kilometer",
      meals: "Mahlzeiten",
      noMeals: "Keine",
      oneMeal: "1 Mahlzeit bezahlt",
      twoMeals: "2+ Mahlzeiten bezahlt",
      taggeldGross: "Taggeld Brutto",
      taggeldNet: "Taggeld Netto",
      mileage: "Kilometergeld",
      totalTaxFree: "Gesamt steuerfrei",
      taxable: "KV-Überschuss (steuerpfl.)",
      taxFreeBadge: "§26 Z 4 EStG — steuer- und sozialversicherungsfrei",
      secondaryWorkplace: "Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)",
      secondaryWarning: "Tätigkeitsmittelpunkt — Taggeld nicht erstattungsfähig",
      approvedOn: "Genehmigt am",
      immutable: "Unveränderbar gemäß BAO §131",
      rejected: "Abgelehnt",
    },
    // Status badges
    status: {
      DRAFT: "Entwurf",
      PENDING: "Ausstehend",
      APPROVED: "Genehmigt",
      REJECTED: "Abgelehnt",
    },
    // Settings
    settings: {
      title: "Einstellungen",
      subtitle: "Erscheinungsbild und Sprache anpassen",
      appearance: "Erscheinungsbild",
      appearanceHint: "Wählen Sie Ihr bevorzugtes Design",
      themeLight: "Hell",
      themeDark: "Dunkel",
      themeSystem: "System",
      language: "Sprache",
      languageHint: "Anzeigesprache der App",
      account: "Konto",
      accountHint: "Ihre Kontodaten",
      name: "Name",
      role: "Rolle",
      roleAdmin: "Administrator",
      roleUser: "Mitarbeiter",
      signOut: "Abmelden",
    },
    // Common
    common: {
      loading: "Laden…",
      error: "Etwas ist schiefgelaufen",
      errorHint: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      retry: "Erneut versuchen",
      back: "Zurück",
    },
  },

  en: {
    nav: {
      overview: "Overview",
      trips: "Trips",
      newTrip: "New Trip",
      admin: "Approvals",
      analytics: "Analytics",
      settings: "Settings",
      administration: "Administration",
      signOut: "Sign out",
    },
    dashboard: {
      greeting: "Good day",
      subtitle: "Travel expense overview",
      newTrip: "New Trip",
      allTrips: "All Trips",
      recentTrips: "Recent Trips",
      showAll: "Show all",
      noTrips: "No trips yet",
      noTripsHint: "Start with your first business trip",
      startFirstTrip: "Create first trip",
      mileageCap: "Annual mileage allowance",
      remaining: "km remaining at €0.50",
      exhausted: "used",
      limitReached: "Annual limit reached — further kilometres are reimbursed at €0",
    },
    kpi: {
      taxFree: "Tax-free approved",
      taxFreeHint: "Per diem + mileage",
      taxable: "Taxable excess",
      taxableHint: "Taxable portion",
      pending: "Pending",
      pendingHint: "Trips awaiting approval",
      total: "Total trips",
      totalHint: "incl. drafts",
      approved: "approved",
    },
    trips: {
      title: "My Trips",
      recorded: "recorded",
      trip: "trip",
      trips: "trips",
      filterAll: "All",
      filterDraft: "Draft",
      filterPending: "Pending",
      filterApproved: "Approved",
      filterRejected: "Rejected",
      searchPlaceholder: "Search destination or purpose…",
      noResults: "No results for",
      noResultsHint: "Try a different search term",
      noTrips: "No trips yet",
      noTripsHint: "Start recording your first business trip",
      startFirst: "Record first trip",
      taxFree: "tax-free",
    },
    tripDetail: {
      back: "Back",
      travelData: "Trip details",
      calculation: "Calculation §26 EStG",
      receipts: "Receipts",
      departure: "Departure",
      return: "Return",
      duration: "Duration",
      kilometers: "Kilometres",
      meals: "Meals",
      noMeals: "None",
      oneMeal: "1 meal paid",
      twoMeals: "2+ meals paid",
      taggeldGross: "Per diem gross",
      taggeldNet: "Per diem net",
      mileage: "Mileage allowance",
      totalTaxFree: "Total tax-free",
      taxable: "Taxable excess",
      taxFreeBadge: "§26 Z 4 EStG — exempt from income tax and social security",
      secondaryWorkplace: "Regular workplace — per diem €0 (5/15-day rule)",
      secondaryWarning: "Regular workplace — per diem not reimbursable",
      approvedOn: "Approved on",
      immutable: "Immutable per BAO §131",
      rejected: "Rejected",
    },
    status: {
      DRAFT: "Draft",
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
    },
    settings: {
      title: "Settings",
      subtitle: "Customise appearance and language",
      appearance: "Appearance",
      appearanceHint: "Choose your preferred theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      language: "Language",
      languageHint: "App display language",
      account: "Account",
      accountHint: "Your account details",
      name: "Name",
      role: "Role",
      roleAdmin: "Administrator",
      roleUser: "Employee",
      signOut: "Sign out",
    },
    common: {
      loading: "Loading…",
      error: "Something went wrong",
      errorHint: "An unexpected error occurred. Please try again or contact support.",
      retry: "Try again",
      back: "Back",
    },
  },
} as const;

export type TranslationKeys = typeof translations.de;

export function t(locale: Locale, path: string): string {
  const parts = path.split(".");
  let obj: unknown = translations[locale];
  for (const part of parts) {
    if (obj && typeof obj === "object" && part in (obj as Record<string, unknown>)) {
      obj = (obj as Record<string, unknown>)[part];
    } else {
      // Fallback to German
      obj = translations.de;
      for (const p of parts) {
        if (obj && typeof obj === "object" && p in (obj as Record<string, unknown>)) {
          obj = (obj as Record<string, unknown>)[p];
        }
      }
      break;
    }
  }
  return typeof obj === "string" ? obj : path;
}
