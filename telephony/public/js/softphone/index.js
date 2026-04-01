/* global frappe */

import { SoftphoneWidget } from "./ui_widget.js";

// Used to verify the running asset version (helps avoid cache confusion).
// Replaced by build tooling (see `telephony/build/softphone.js`).
// eslint-disable-next-line no-undef
export const TP_SOFTPHONE_BUILD =
  typeof __TP_SOFTPHONE_BUILD__ !== "undefined" ? __TP_SOFTPHONE_BUILD__ : "dev";

export async function bootstrapSoftphone() {
  frappe.provide("telephony.sip");

  const sipNs = window.telephony?.sip;
  if (!sipNs) return;
  if (sipNs.instance) return;
  const softphone = new SoftphoneWidget({ buildSignature: TP_SOFTPHONE_BUILD });
  sipNs.instance = softphone;
  await softphone.init();
}

export function installSoftphoneBootstrap() {
  frappe.provide("telephony.sip");

  const sipNs = window.telephony?.sip;
  if (!sipNs) return;

  sipNs.bootstrap = async () => {
    await bootstrapSoftphone();
  };

  const ensureBootstrapped = () => void sipNs.bootstrap();

  if (typeof frappe.ready === "function") {
    frappe.ready(ensureBootstrapped);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBootstrapped, { once: true });
  } else {
    ensureBootstrapped();
  }
  frappe.after_ajax(ensureBootstrapped);
}

// Side-effect: install bootstrap on import (matches legacy behavior where the
// script self-bootstraps on `frappe.ready`).
installSoftphoneBootstrap();
