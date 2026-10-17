/**
 * Tuition fee defaults and rules.
 * All amounts are in BDT. Edit these values when university policy
 * changes — the calculator, its tests and the rendered breakdown
 * all read from here.
 */

export const FEE_RULES = {
  defaults: {
    /** Standard per-credit tuition rate. Editable in the UI. */
    perCreditFee: 5500,
    /** Fixed charge per trimester — never reduced by waiver/scholarship. */
    trimesterFee: 6500,
  },

  /** One-off fine when registration happens after the deadline. */
  lateFee: 500,

  /**
   * Waiver applied to FIRST-TIME retake tuition.
   * NOTE: the original reference site is inconsistent here — its copy says
   * retakes get no waiver, yet it also advertises "Retake Credit (1st Time)
   * applies 50% waiver". We implement the 50% first-time retake rule as a
   * config option so the owner can flip it to 0 if official policy differs.
   */
  retakeFirstWaiver: 0.5,
  /** 2nd-or-later retakes pay full tuition, no waiver. */
  retakeLaterWaiver: 0,

  /** Regular tuition waiver tiers (fraction of tuition). */
  waiverOptions: [0, 0.25, 0.5],
  /** Merit scholarship tiers (fraction of tuition). */
  scholarshipOptions: [0, 0.25, 0.5, 1],

  /**
   * A scholarship covers at most this many new credits; any additional
   * credits fall back to the waiver rate. The higher of (waiver,
   * scholarship) applies.
   */
  scholarshipMaxCredits: 13,

  /** Special waivers — stack on top of regular discounts. */
  specialWaivers: {
    sibling: 0.2,      // Sibling / spouse waiver
    ethnic: 0.25,      // Ethnic groups / tribal waiver
    disabilityModerate: 0.25,
    disabilitySevere: 0.5,
  },

  /**
   * From this batch onward the special waivers above are no longer
   * stackable with each other (only the single highest applies).
   */
  specialStackBatch: 251,

  /** Standard installment split of the gross fee (40% / 30% / 30%). */
  installmentSplit: [0.4, 0.3, 0.3],
};

/** Human-readable labels for the installment rows. */
export const INSTALLMENT_LABELS = ['1st installment', '2nd installment', '3rd installment'];
