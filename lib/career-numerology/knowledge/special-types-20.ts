import type { SpecialTypeId, Type45Key } from "../types";

export type SpecialTypeGroup = {
  id: SpecialTypeId;
  members: readonly Type45Key[];
  status: "verified";
};

export const specialTypeGroups: Record<SpecialTypeId, SpecialTypeGroup> = {
  四大帝王: { id: "四大帝王", members: ["19/10/1", "48/12/3", "17/8", "18/9"], status: "verified" },
  四大卓越: { id: "四大卓越", members: ["11/2", "22/4", "33/6", "44/8"], status: "verified" },
  四大鬼才: { id: "四大鬼才", members: ["37/10/1", "38/11/2", "25/7", "27/9"], status: "verified" },
  四大业务: { id: "四大业务", members: ["37/10/1", "30/3", "32/5", "35/8"], status: "verified" },
  四大人才: { id: "四大人才", members: ["47/11/2", "12/3", "31/4", "25/7"], status: "verified" },
};

export function getSpecialTypesForKey(key: Type45Key): SpecialTypeId[] {
  return Object.values(specialTypeGroups)
    .filter((group) => group.members.includes(key))
    .map((group) => group.id);
}
