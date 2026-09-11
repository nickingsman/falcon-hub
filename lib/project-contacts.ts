export const PROJECT_CONTACT_OPTIONS = [
  { name: "Weiwei", phone: "6016-935 8336" },
  { name: "Matthew", phone: "6011-5676 7398" },
  { name: "Katherine", phone: "6017-333 5868" },
  { name: "Nicholas", phone: "6010-279 0296" },
] as const;

export function getProjectContactOptionValue(name: string, phone: string) {
  return JSON.stringify([name, phone]);
}

export function findProjectContactOption(value: string) {
  return PROJECT_CONTACT_OPTIONS.find(
    (contact) => getProjectContactOptionValue(contact.name, contact.phone) === value,
  );
}

export function getSelectedProjectContactValue(name: string, phone: string) {
  if (!name && !phone) return "";

  const contact = PROJECT_CONTACT_OPTIONS.find(
    (option) => option.name === name && option.phone === phone,
  );

  return contact ? getProjectContactOptionValue(contact.name, contact.phone) : "custom";
}
