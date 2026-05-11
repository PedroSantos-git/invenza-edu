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
    
    if (!imob) {
      individualItems.push({ ...eq, isKit: false });
      return;
    }

    if (!kits.has(imob)) {
      kits.set(imob, {
        imobilizado: imob,
        main: null,
        components: [],
        ids: [],
        isKit: true
      });
    }

    const kit = kits.get(imob);
    kit.ids.push(eq.id);

    if (isMainEquipment(eq)) {
      if (kit.main) {
        // Se já houver um PC, este vira componente (caso raro de 2 PCs no mesmo imob)
        kit.components.push(eq);
      } else {
        kit.main = eq;
      }
    } else {
      kit.components.push(eq);
    }
  });

  const groupedKits = Array.from(kits.values()).map(kit => {
    // Se um kit não tem PC, o primeiro item vira o "líder" visual
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
        componentTypes: kit.components.map(c => c.tipo).join(', ')
      },
      isKit: true
    };
  });

  // Retornar primeiro os Kits com PC, depois outros Kits, depois individuais
  return [
    ...groupedKits.sort((a, b) => {
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
 */
export const getKitIds = (equipment, allEquipments) => {
  const imob = equipment?.numero_imobilizado?.trim();
  if (!imob) return [equipment?.id].filter(Boolean);

  return allEquipments
    .filter(eq => eq.numero_imobilizado?.trim() === imob)
    .map(eq => eq.id);
};

/**
 * Finds all kits with discrepancies in state or warehouse location
 */
export const findKitDiscrepancies = (equipments) => {
  if (!equipments || !Array.isArray(equipments)) return [];

  const kits = new Map();

  equipments.forEach(eq => {
    const imob = eq.numero_imobilizado?.trim();
    if (!imob) return;

    if (!kits.has(imob)) {
      kits.set(imob, []);
    }
    kits.get(imob).push(eq);
  });

  const discrepancies = [];

  kits.forEach((items, imob) => {
    if (items.length <= 1) return;

    const first = items[0];
    const hasEstadoDiff = items.some(item => item.estado !== first.estado);
    const hasArmazemDiff = items.some(item => item.situacao_armazem !== first.situacao_armazem);

    if (hasEstadoDiff || hasArmazemDiff) {
      discrepancies.push({
        imobilizado: imob,
        items,
        hasEstadoDiff,
        hasArmazemDiff,
        mainItem: items.find(isMainEquipment) || items[0]
      });
    }
  });

  return discrepancies;
};
