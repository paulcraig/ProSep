class Constants:

    MW_RANGE = {
        MIN: 0,
        MAX: 200000  # 200 kDa
    }

    PH_RANGE = {
        MIN: 3,
        MAX: 10
    }

    DEFAULT_PROTEINS = [
        { name: "β-Galactosidase", color: "#4287f5", mw: 116000, pI: 4.6 },
        { name: "Phosphorylase B", color: "#42f587", mw: 97000, pI: 6.8 },
        { name: "Serum Albumin", color: "#42d4f5", mw: 66000, pI: 5.7 },
        { name: "Ovalbumin", color: "#f542f2", mw: 45000, pI: 4.5 },
        { name: "Carbonic Anhydrase", color: "#f54242", mw: 29000, pI: 6.6 },
        { name: "Trypsin Inhibitor", color: "#4542f5", mw: 20100, pI: 4.5 },
        { name: "Lysozyme", color: "#42f5d4", mw: 14300, pI: 9.2 },
        { name: "Aprotinin", color: "#f58742", mw: 6500, pI: 10.5 }
    ]