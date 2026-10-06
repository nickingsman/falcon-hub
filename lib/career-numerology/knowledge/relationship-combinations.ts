import type {
  RelationshipKnowledge,
  RelationshipNumber,
} from "../types";

const relationshipNumbers = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const relationshipCombinationKnowledge = Object.fromEntries(
  relationshipNumbers.map((number) => [
    number,
    {
      number,
      title: `人际运数 ${number}`,
      status: "unresolved",
    },
  ]),
) as Record<RelationshipNumber, RelationshipKnowledge>;

relationshipCombinationKnowledge[6] = {
  number: 6,
  title: "人际运数 6",
  strengths: ["双方愿意为彼此改变成长，也愿意为对方着想，彼此愿意接纳对方，关系较长久。"],
  challenges: ["好的时候很好，不好的时候容易互相攻击；一旦对对方失望，批评时容易翻旧账。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[2] = {
  number: 2,
  title: "人际运数 2",
  strengths: ["可以维持感情，不因一时心情影响关系；遇到事情能够有事论事，彼此互相支持、理解，相处较和谐。"],
  challenges: ["容易觉得自己为了对方忍让很多，却没有说出来；情感可能有所保留，也容易为了维持关系而委曲求全。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[3] = {
  number: 3,
  title: "人际运数 3",
  strengths: ["沟通与表达较没有障碍，互动带有浪漫感，也比较勇于表达自己的内心。"],
  challenges: ["比较容易只想到自己；即使双方能够互相同理，仍可能觉得对方给予自己的不够。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[4] = {
  number: 4,
  title: "人际运数 4",
  strengths: ["彼此容易有像家人的感觉，合作较稳定；当双方把权责与分工处理清楚后，合作关系可以维持较长久。"],
  challenges: ["容易出现权责不清、各执己见的情况，因此事情需要讲清楚；当双方存在利益关系时，更容易产生冲突。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[5] = {
  number: 5,
  title: "人际运数 5",
  strengths: ["双方会创造新的经历，彼此喜欢尝新与冒险；不需要过度依赖彼此，相处没有明显阶级之分，关系中需要保有生活感与情趣。"],
  challenges: ["彼此较独立，也各有自己的想法；一起共事时容易搞不清楚各自职责，发生问题时可能互相推诿，导致问题没有真正解决。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[7] = {
  number: 7,
  title: "人际运数 7",
  strengths: ["彼此心胸较开阔，可以分享信息，心灵交流较多；重视灵魂层面的交流，对彼此较坦荡，事情能够讲清楚、说明白。"],
  challenges: ["不要把情绪闷在心里；争执后容易疑神疑鬼或把事情藏起来，因此沟通一定要做好，有不满或嫌隙时需要明确讲清楚。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[8] = {
  number: 8,
  title: "人际运数 8",
  strengths: ["双方可以共同创业、建立共同愿景；只要事业有实质成果，彼此较容易获得稳定感。金钱问题处理好、事业上有共同语言时，关系较容易稳定。"],
  challenges: ["双方容易因为金钱或权力产生争执；金钱纠纷严重时可能导致关系决裂。若是夫妻，也容易因为事业或金钱问题发生争执。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[9] = {
  number: 9,
  title: "人际运数 9",
  strengths: ["双方理念较容易相合，可以互相理解、相敬如宾；不喜欢压制对方，能够爱、忍耐并尊重彼此的想法。"],
  challenges: ["不适合用争吵处理问题；一旦争执容易互相揭短，负面情绪可能持续较长时间，也可能出现各过各的、关系疏离但又分不开的状态。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[10] = {
  number: 10,
  title: "人际运数 10",
  strengths: ["不管感情如何，看起来像手足，容易培养默契，也需要各自的生活空间。"],
  challenges: ["一旦争执容易不说话，把自己的委屈藏起来；生闷气时不容易先向对方道歉。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[11] = {
  number: 11,
  title: "人际运数 11",
  strengths: ["具有火花四射的创造能量，相处时负面思想较少；一起做事容易产生火花与动力。"],
  challenges: ["争执后的心结可能维持较长时间，问题不适合长期拖着不处理。"],
  status: "verified_normalized",
};

relationshipCombinationKnowledge[12] = {
  number: 12,
  title: "人际运数 12",
  strengths: ["彼此能够互相搭配，也懂得分享，同时需要给予对方一定的独立空间。"],
  challenges: ["不把事情说明清楚容易造成混乱；工作、交友等方面需要保留适当空间。"],
  status: "verified_normalized",
};
