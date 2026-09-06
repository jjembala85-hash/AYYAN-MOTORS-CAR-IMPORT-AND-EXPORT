/** Contact details carried over from the existing ayyanmotorsltd.com site. */
export const CONTACT = {
  phones: ["+256 702 994484", "+256 787 551514", "+256 758 659633"],
  email: "ayyanmotorsltd99@gmail.com",
  address: "Rubaga Road, Access Building, Rm 302, Kampala, Uganda",
  hours: ["Mon–Fri 08:00–18:00", "Sat 08:00–13:00"],
} as const;

/** The line answered first — used for the header CTA and every enquiry button. */
export const PRIMARY_PHONE = CONTACT.phones[0];

export function telHref(phone: string = PRIMARY_PHONE): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

/** wa.me wants the number bare: no plus, no spaces. */
export function whatsappHref(message: string, phone: string = PRIMARY_PHONE): string {
  const number = phone.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function mailtoHref(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject, ...(body ? { body } : {}) });
  return `mailto:${CONTACT.email}?${params.toString()}`;
}

/** "I'm interested in the 2021 Toyota Hilux Revo listed on your website." */
export function enquiryMessage(headline: string): string {
  return `Hello Ayyan Motors, I'm interested in the ${headline} listed on your website. Is it still available?`;
}
