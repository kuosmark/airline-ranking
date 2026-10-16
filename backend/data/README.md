# Aircraft type reference

`faa-aircraft-types.json` contains 2,699 specific aircraft type designators from
[FAA Order JO 7360.1K, Appendix A](https://www.faa.gov/documentLibrary/media/Order/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf),
effective 12 June 2025. It was extracted from the published table on 16 October 2026.
Each entry keeps a representative manufacturer and model from that designator's
row. A designator can cover several manufacturers or variants; this is not a
complete model-alias list. FAA manufacturer disambiguation suffixes are retained.
Generic designators such as GLID, BALL and ULAC are excluded from specific type
rankings, as is ZZZZ.

The backend bundles this lookup; it makes no FAA requests at runtime. Familiar
display labels and the small set of verified model aliases remain in
`../aircraft-types.ts`. The FAA reference covers types approved for use in the
US National Airspace System and can lag ICAO changes.

To update it, extract the designator and manufacturer/model columns from a newer
FAA edition, compare added/removed codes and changed labels, and verify changed
entries against their PDF rows before replacing the file. Preserve one entry per
code and exclude generic designators. Update the edition/date here and run the
project checks. Do not infer type codes from unverified model similarities.
