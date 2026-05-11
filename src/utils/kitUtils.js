/**
 * Kit Utilities
 * Centralizes logic for grouping equipments by 'numero_imobilizado'
 */

export const isMainEquipment = (eq) => {
  if (!eq || !eq.tipo) return false;
  return eq.tipo.toUpperCase().startsWith('PC');
};

export const groupEquipmentsIntoKits = (equipments) => {
  if (!equipments || !Array.isArray(equipments)) return [];

  const kits = new Map();
  const individualItems = [];

  equipments.forEach(eq => {
    const imob = eq.numero_imobilizado?.trim();
    const isSubstituido = eq.estado === 'Substituido';
    
    // Identificador único para o kit considera o imobilizado e o estado 'Substituido'
    // Se for Substituido, ele só agrupa com outros Substituidos do mesmo imobilizado
    const kitKey = isSubstituido ? `SUBST_${imob}` : imob;

    if (!imob) {
      individualItems.push({ ...eq, isKit: false });
      return;
    }

    if (!kits.has(kitKey)) {
      kits.set(kitKey, {
        imobilizado: imob,
        main: null,
        components: [],
        ids: [],
        isKit: true,
        isSubstituidoGroup: isSubstituido
      });
    }

    const kit = kits.get(kitKey);
    kit.ids.push(eq.id);

    if (isMainEquipment(eq)) {
      if (kit.main) {
        kit.components.push(eq);
      } else {
        kit.main = eq;
      }
    } else {
      kit.components.push(eq);
    }
  });

  const groupedKits = Array.from(kits.values()).map(kit => {
    if (!kit.main && kit.components.length > 0) {
      kit.main = kit.components[0];
      kit.components = kit.components.slice(1);
    }
    
    return {
      ...kit.main,
      id: kit.main?.id,
      kitData: {
        imobilizado: kit.imobilizado,
        components: kit.components,
        allIds: kit.ids,
        componentTypes: kit.components.map(c => c.tipo).join(', '),
        totalCount: kit.ids.length
      },
      isKit: true
    };
  });

  // Ordenação: 
  // 1. Kits com mais de 2 equipamentos primeiro
  // 2. Kits normais (PC primeiro)
  // 3. Individuais
  return [
    ...groupedKits.sort((a, b) => {
      // Prioridade 1: Kits grandes (mais de 2 itens)
      const aSize = a.kitData.totalCount;
      const bSize = b.kitData.totalCount;
      if (aSize > 2 && bSize <= 2) return -1;
      if (aSize <= 2 && bSize > 2) return 1;
      
      // Prioridade 2: PCs
      const aIsPC = isMainEquipment(a);
      const bIsPC = isMainEquipment(b);
      if (aIsPC && !bIsPC) return -1;
      if (!aIsPC && bIsPC) return 1;
      
      return 0;
    }),
    ...individualItems
  ];
};

/**
 * Finds all equipment IDs belonging to the same kit as the given equipment
 * Respects the 'Substituido' isolation rule.
 */
export const getKitIds = (equipment, allEquipments) => {
  const imob = equipment?.numero_imobilizado?.trim();
  if (!imob) return [equipment?.id].filter(Boolean);

  const isSub = equipment.estado === 'Substituido';

  return allEquipments
    .filter(eq => {
      const sameImob = eq.numero_imobilizado?.trim() === imob;
      if (isSub) return sameImob && eq.estado === 'Substituido';
      return sameImob && eq.estado !== 'Substituido';
    })
    .map(eq => eq.id);
};

/**
 * Finds all kits with discrepancies in state or warehouse location
 * Respects the 'Substituido' isolation rule.
 */
export const findKitDiscrepancies = (equipments) => {
  if (!equipments || !Array.isArray(equipments)) return [];

  const kits = new Map();

  equipments.forEach(eq => {
    const imob = eq.numero_imobilizado?.trim();
    if (!imob) return;
    
    const isSub = eq.estado === 'Substituido';
    const kitKey = isSub ? `SUBST_${imob}` : imob;

    if (!kits.has(kitKey)) {
      kits.set(kitKey, []);
    }
    kits.get(kitKey).push(eq);
  });

  const discrepancies = [];

  kits.forEach((items, key) => {
    if (items.length <= 1) return;

    const first = items[0];
    const hasEstadoDiff = items.some(item => item.estado !== first.estado);
    const hasArmazemDiff = items.some(item => item.situacao_armazem !== first.situacao_armazem);

    if (hasEstadoDiff || hasArmazemDiff) {
      discrepancies.push({
        kitKey: key,
        imobilizado: items[0].numero_imobilizado,
        items,
        hasEstadoDiff,
        hasArmazemDiff,
        mainItem: items.find(isMainEquipment) || items[0],
        slaveItem: items.find(eq => eq.tipo?.toUpperCase().includes('HOTSPOT')) || items.find(eq => !isMainEquipment(eq)) || items[0]
      });
    }
  });

  // Ordenar discrepâncias: Kits com mais equipamentos primeiro
  return discrepancies.sort((a, b) => b.items.length - a.items.length);
};
