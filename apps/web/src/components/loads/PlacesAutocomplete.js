"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * PlacesAutocomplete
 *
 * Uses PlaceAutocompleteElement for the input UI and google.maps.places.Place
 * with fetchFields for field extraction (Places API New).
 *
 * Props:
 *  value        {string}   - initial address text (hidden input for HTML validation)
 *  initialValue {string}   - text to pre-fill the visible autocomplete input on mount
 *  onChange     {fn}       - called with { address, city, state, pincode, lat, lng }
 *  placeholder  {string}
 *  required     {boolean}
 *  mapsLoaded   {boolean}  - optional fast-path trigger
 */
export default function PlacesAutocomplete({ value, initialValue, onChange, placeholder, required, mapsLoaded }) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const hiddenRef = useRef(null);

  // Ref so the event listener always calls the latest onChange without stale closure
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Ref so we can apply initialValue after element creation without re-init
  const initialValueRef = useRef(initialValue);

  const initElement = useCallback(() => {
    if (!containerRef.current || elementRef.current) return;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return;

    const el = new window.google.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ["in"],
    });

    if (placeholder) el.placeholder = placeholder;

    // Pre-fill the visible search input with the branch/initial address text
    if (initialValueRef.current) {
      el.value = initialValueRef.current;
    }

    async function handleSelect(event) {
      // gmp-select (new): event.placePrediction — use toPlace() for a Place instance
      // gmp-placeselect (old beta): event.place — already a Place-like object with .id
      let place;
      if (event.placePrediction) {
        place = event.placePrediction.toPlace();
      } else if (event.place?.id) {
        place = new window.google.maps.places.Place({ id: event.place.id });
      } else {
        console.error("[PlacesAutocomplete] selection event had no place data", event);
        return;
      }

      try {
        await place.fetchFields({ fields: ["addressComponents", "formattedAddress", "location"] });
      } catch (err) {
        console.error("[PlacesAutocomplete] fetchFields failed:", err);
        return;
      }

      const components = place.addressComponents ?? [];
      const get = (type) =>
        components.find((c) => c.types.includes(type))?.longText ?? "";

      const city =
        get("locality") ||
        get("administrative_area_level_2") ||
        get("sublocality_level_1");
      const state   = get("administrative_area_level_1");
      const pincode = get("postal_code");
      const lat     = place.location?.lat() ?? null;
      const lng     = place.location?.lng() ?? null;
      const address = place.formattedAddress ?? "";

      if (hiddenRef.current) hiddenRef.current.value = address;
      onChangeRef.current({ address, city, state, pincode, lat, lng });
    }

    // Listen on both event names — the API changed between beta versions
    el.addEventListener("gmp-select", handleSelect);
    el.addEventListener("gmp-placeselect", handleSelect);

    containerRef.current.appendChild(el);
    elementRef.current = el;
  }, [placeholder]);

  const tryInit = useCallback(() => {
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      initElement();
      return true;
    }
    return false;
  }, [initElement]);

  // Fast-path: runs when Script onLoad fires
  useEffect(() => {
    if (mapsLoaded) tryInit();
  }, [mapsLoaded, tryInit]);

  // Polling fallback for cached/delayed script loads
  useEffect(() => {
    if (tryInit()) return; // already ready
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [tryInit]);

  return (
    <div
      className="places-autocomplete-root"
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
    >
      {/* Invisible input — keeps native HTML `required` validation working */}
      <input
        ref={hiddenRef}
        type="text"
        defaultValue={value}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
      />
      {/* PlaceAutocompleteElement is appended here imperatively */}
      <div ref={containerRef} />
    </div>
  );
}
