import {
    useCallback,
    useMemo,
    useState,
    startTransition,
    type FormEvent,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// User request: Create a self-contained Fixly Booking Engine component with shared booking state, 12 categories, quantity controls, cleaning 
calculator, 4-step flow (When/Where/Contact/Confirm), WhatsApp photo CTA, required submission simulation, responsive white/blue rounded-card styling, 
and configurable controls for city/whatsapp/pricing/accent.

type City = "Praha" | "Plzeň" | "Karlovy Vary"
type Category =
    | "Plumbing"
    | "Electrical"
    | "Handyman"
    | "Furniture Assembly"
    | "Cleaning"
    | "Dry Cleaning"
    | "Mounting"
    | "Moving"
    | "Minor Repairs"
    | "Other"
    | "Window Cleaning"
    | "Locks & Doors"

interface ServiceItem {
    name: string
    price: number
}

interface MyComponentProps {
    initialCity: City
    whatsappNumber: string
    recipientEmail: string
    webhookUrl: string
    baseApartmentPrice: number
    additionalRoomPrice: number
    bathroomPrice: number
    houseSurcharge: number
    accentColor: string
}

const categoryData: Record<Category, ServiceItem[]> = {
    Plumbing: [
        { name: "Leak repair", price: 900 },
        { name: "Faucet replacement", price: 1200 },
        { name: "Drain cleaning", price: 1100 },
    ],
    Electrical: [
        { name: "Socket replacement", price: 850 },
        { name: "Light fixture install", price: 1050 },
        { name: "Breaker diagnostics", price: 1300 },
    ],
    Handyman: [
        { name: "Shelf installation", price: 700 },
        { name: "Curtain rod install", price: 800 },
        { name: "Door adjustment", price: 950 },
    ],
    "Furniture Assembly": [
        { name: "Wardrobe assembly", price: 1600 },
        { name: "Bed frame assembly", price: 1200 },
        { name: "Desk assembly", price: 1100 },
    ],
    Cleaning: [
        { name: "Deep kitchen clean", price: 1400 },
        { name: "Bathroom deep clean", price: 1200 },
        { name: "Post-renovation cleaning", price: 2200 },
    ],
    "Dry Cleaning": [
        { name: "Carpet dry cleaning", price: 1300 },
        { name: "Sofa dry cleaning", price: 1500 },
        { name: "Mattress dry cleaning", price: 1400 },
    ],
    Mounting: [
        { name: "TV wall mounting", price: 1700 },
        { name: "Mirror mounting", price: 900 },
        { name: "Picture set mounting", price: 800 },
    ],
    Moving: [
        { name: "Small apartment move", price: 3200 },
        { name: "Furniture transport", price: 2400 },
        { name: "Packing assistance", price: 1800 },
    ],
    "Minor Repairs": [
        { name: "Wall patch & paint", price: 1000 },
        { name: "Cabinet hinge fix", price: 800 },
        { name: "Tile re-grouting", price: 1200 },
    ],
    Other: [
        { name: "Custom service callout", price: 1000 },
        { name: "Inspection visit", price: 900 },
        { name: "General labor hour", price: 750 },
    ],
    "Window Cleaning": [
        { name: "Interior windows", price: 900 },
        { name: "Exterior windows", price: 1400 },
        { name: "Balcony glass cleaning", price: 1100 },
    ],
    "Locks & Doors": [
        { name: "Lock replacement", price: 1600 },
        { name: "Door alignment", price: 1200 },
        { name: "Handle repair", price: 850 },
    ],
}

const categories = Object.keys(categoryData) as Category[]

function toDateOffset(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().split("T")[0]
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function FixlyBookingEngine(props: MyComponentProps) {
    const isStatic = useIsStaticRenderer()
    const {
        initialCity,
        whatsappNumber,
        recipientEmail,
        webhookUrl,
        baseApartmentPrice,
        additionalRoomPrice,
        bathroomPrice,
        houseSurcharge,
        accentColor,
    } = props

    const [city, setCity] = useState<City>(initialCity)
    const [activeCategory, setActiveCategory] = useState<Category>("Plumbing")
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [propertyType, setPropertyType] = useState<"apartment" | "house">(
        "apartment"
    )
    const [rooms, setRooms] = useState(1)
    const [bathrooms, setBathrooms] = useState(0)
    const [step, setStep] = useState<"When" | "Where" | "Contact" | "Confirm">(
        "When"
    )
    const [whenOption, setWhenOption] = useState<
        "ASAP" | "Today" | "Tomorrow" | "Choose Date"
    >("ASAP")
    const [dateValue, setDateValue] = useState(toDateOffset(0))
    const [timeSlot, setTimeSlot] = useState<
        "Morning" | "Afternoon" | "Evening"
    >("Morning")
    const [street, setStreet] = useState("")
    const [houseNumber, setHouseNumber] = useState("")
    const [apartmentNumber, setApartmentNumber] = useState("")
    const [floor, setFloor] = useState("")
    const [doorbellName, setDoorbellName] = useState("")
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [notes, setNotes] = useState("")
    const [additionalDetails, setAdditionalDetails] = useState("")
    const [submitState, setSubmitState] = useState<
        "idle" | "pending" | "success" | "error"
    >("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const [lastBookingId, setLastBookingId] = useState("")
    const [lastSubmittedDate, setLastSubmittedDate] = useState("")

    const activeServices = categoryData[activeCategory]

    const selectedItems = useMemo(() => {
        return categories.flatMap(
            (cat) =>
                categoryData[cat]
                    .map((item) => {
                        const key = `${cat}::${item.name}`
                        const qty = quantities[key] || 0
                        return qty > 0
                            ? {
                                  category: cat,
                                  name: item.name,
                                  price: item.price,
                                  qty,
                                  lineTotal: item.price * qty,
                              }
                            : null
                    })
                    .filter(Boolean) as Array<{
                    category: Category
                    name: string
                    price: number
                    qty: number
                    lineTotal: number
                }>
        )
    }, [quantities])

    const servicesTotal = useMemo(
        () => selectedItems.reduce((sum, item) => sum + item.lineTotal, 0),
        [selectedItems]
    )

    const cleaningEstimate = useMemo(() => {
        const base = baseApartmentPrice
        const roomPart = Math.max(0, rooms - 1) * additionalRoomPrice
        const bathroomPart = bathrooms * bathroomPrice
        const propertyPart = propertyType === "house" ? houseSurcharge : 0
        return base + roomPart + bathroomPart + propertyPart
    }, [
        baseApartmentPrice,
        additionalRoomPrice,
        bathroomPrice,
        houseSurcharge,
        propertyType,
        rooms,
        bathrooms,
    ])

    const grandTotal = useMemo(() => {
        return activeCategory === "Cleaning"
            ? servicesTotal + cleaningEstimate
            : servicesTotal
    }, [activeCategory, servicesTotal, cleaningEstimate])

    const autoServiceText = useMemo(() => {
        if (selectedItems.length === 0) return "No services selected yet."
        return selectedItems
            .map((item) => `${item.category}: ${item.name} × ${item.qty}`)
            .join("; ")
    }, [selectedItems])

    const serviceTextareaValue = useMemo(() => {
        return additionalDetails.trim().length > 0
            ? `${autoServiceText}\n\nAdditional details:\n${additionalDetails}`
            : autoServiceText
    }, [autoServiceText, additionalDetails])

    const whenLabel = useMemo(() => {
        if (whenOption === "Today") return toDateOffset(0)
        if (whenOption === "Tomorrow") return toDateOffset(1)
        if (whenOption === "Choose Date") return dateValue
        return "ASAP"
    }, [whenOption, dateValue])

    const addressLine = useMemo(() => {
        const base = [street.trim(), houseNumber.trim()]
            .filter(Boolean)
            .join(" ")
        const details = [
            apartmentNumber.trim() ? `Apt ${apartmentNumber.trim()}` : "",
            floor.trim() ? `Floor ${floor.trim()}` : "",
            doorbellName.trim() ? `Doorbell ${doorbellName.trim()}` : "",
        ].filter(Boolean)
        if (details.length === 0) return [base, city].filter(Boolean).join(", ")
        return [base, city, details.join(", ")].filter(Boolean).join(", ")
    }, [street, houseNumber, apartmentNumber, floor, doorbellName, city])

    const serializedPayload = useMemo(
        () =>
            JSON.stringify({
                city,
                category: activeCategory,
                services: selectedItems,
                total: grandTotal,
                cleaning: {
                    propertyType,
                    rooms,
                    bathrooms,
                    cleaningEstimate,
                },
                when: whenLabel,
                timeSlot,
                address: {
                    city,
                    street,
                    houseNumber,
                    apartmentNumber,
                    floor,
                    doorbellName,
                    fullAddress: addressLine,
                },
                customer: { name, phone, email },
                notes,
                specificService: serviceTextareaValue,
            }),
        [
            city,
            activeCategory,
            selectedItems,
            grandTotal,
            propertyType,
            rooms,
            bathrooms,
            cleaningEstimate,
            whenLabel,
            timeSlot,
            street,
            houseNumber,
            apartmentNumber,
            floor,
            doorbellName,
            addressLine,
            name,
            phone,
            email,
            notes,
            serviceTextareaValue,
        ]
    )

    const updateQuantity = useCallback(
        (serviceName: string, delta: number) => {
            startTransition(() => {
                setQuantities((prev) => {
                    const key = `${activeCategory}::${serviceName}`
                    const next = Math.max(0, (prev[key] || 0) + delta)
                    return { ...prev, [key]: next }
                })
            })
        },
        [activeCategory]
    )

    const whatsappHref = useMemo(() => {
        const encoded = encodeURIComponent(
            "Dobrý den! Chtěl/a bych získat odhad ceny. Pošlu Vám fotografii problému."
        )
        return `https://wa.me/${whatsappNumber}?text=${encoded}`
    }, [whatsappNumber])

    const successWhatsappHref = useMemo(() => {
        const encoded = encodeURIComponent(
            "Dobrý den! Právě jsem odeslal/a rezervaci přes HOMIO."
        )
        return `https://wa.me/${whatsappNumber}?text=${encoded}`
    }, [whatsappNumber])

    const contactEmailHref = useMemo(() => {
        const subject = encodeURIComponent("HOMIO — Customer request")
        const body = encodeURIComponent(
            [
                "Dobrý den,",
                "",
                "mám zájem o služby HOMIO.",
                "",
                "Jméno:",
                "Telefon:",
                "E-mail:",
                "Město:",
                "Adresa:",
                "Požadovaná služba:",
                "Preferovaný termín a čas:",
                "",
                "Děkuji.",
            ].join("\n")
        )
        return `mailto:${recipientEmail}?subject=${subject}&body=${body}`
    }, [recipientEmail])

    const onSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const phoneValid = /^[+0-9\s()-]{7,}$/.test(phone.trim())
            const streetValid = street.trim().length >= 2
            const houseNumberValid = houseNumber.trim().length >= 1
            if (!streetValid || !houseNumberValid) {
                startTransition(() => {
                    setSubmitState("error")
                    setErrorMessage(
                        "Něco se nepodařilo. Zkuste to prosím znovu nebo nám napište na WhatsApp."
                    )
                    setStep("Where")
                })
                return
            }
            if (!phoneValid || name.trim().length < 2) {
                startTransition(() => {
                    setSubmitState("error")
                    setErrorMessage(
                        "Něco se nepodařilo. Zkuste to prosím znovu nebo nám napište na WhatsApp."
                    )
                    setStep("Contact")
                })
                return
            }
            startTransition(() => {
                setSubmitState("pending")
                setErrorMessage("")
            })

            if (webhookUrl.trim().length === 0) {
                startTransition(() => {
                    setSubmitState("error")
                    setErrorMessage(
                        "Něco se nepodařilo. Zkuste to prosím znovu nebo nám napište na WhatsApp."
                    )
                })
                return
            }

            const submittedDate = new Date().toISOString()
            const bookingId = `HOMIO-${submittedDate.slice(0, 10).replace(/-/g, "")}-${Math.floor(
                1000 + Math.random() * 9000
            )}`
            const sourceUrl =
                typeof window !== "undefined" ? window.location.href : ""
            const queryParams =
                typeof window !== "undefined"
                    ? Object.fromEntries(
                          new URLSearchParams(window.location.search).entries()
                      )
                    : {}

            try {
                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        bookingId,
                        submittedDate,
                        city,
                        category: activeCategory,
                        services: selectedItems.map((item) => ({
                            category: item.category,
                            name: item.name,
                            price: item.price,
                            quantity: item.qty,
                            lineTotal: item.lineTotal,
                        })),
                        estimatedPrice: grandTotal,
                        cleaning: {
                            propertyType,
                            rooms,
                            bathrooms,
                            cleaningEstimate,
                        },
                        preferredDate: whenLabel,
                        preferredTime: timeSlot,
                        customer: { name, phone, email },
                        address: {
                            city,
                            street,
                            houseNumber,
                            apartmentNumber,
                            floor,
                            doorbellName,
                            fullAddress: addressLine,
                        },
                        notes,
                        specificService: serviceTextareaValue,
                        sourceUrl,
                        queryParams,
                    }),
                })

                if (!response.ok) {
                    startTransition(() => {
                        setSubmitState("error")
                        setErrorMessage(
                            "Něco se nepodařilo. Zkuste to prosím znovu nebo nám napište na WhatsApp."
                        )
                    })
                    return
                }

                startTransition(() => {
                    setSubmitState("success")
                    setErrorMessage("")
                    setLastBookingId(bookingId)
                    setLastSubmittedDate(submittedDate)
                })
            } catch (_error) {
                startTransition(() => {
                    setSubmitState("error")
                    setErrorMessage(
                        "Něco se nepodařilo. Zkuste to prosím znovu nebo nám napište na WhatsApp."
                    )
                })
            }
        },
        [
            webhookUrl,
            phone,
            name,
            street,
            houseNumber,
            city,
            activeCategory,
            selectedItems,
            grandTotal,
            propertyType,
            rooms,
            bathrooms,
            cleaningEstimate,
            whenLabel,
            timeSlot,
            email,
            apartmentNumber,
            floor,
            doorbellName,
            addressLine,
            notes,
            serviceTextareaValue,
        ]
    )

    const surface = "#EDF4FF"
    const textPrimary = "#0B1F3A"
    const border = "#DCE8F9"

    return (
        <form
            onSubmit={onSubmit}
            id="fixly-booking-top"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                background: "#F7F9FC",
                borderRadius: 24,
                padding: 16,
                boxSizing: "border-box",
                fontFamily:
                    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                color: textPrimary,
                overflow: "auto",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 14,
                }}
            >
                <section
                    style={{
                        background: "#FFFFFF",
                        borderRadius: 20,
                        border: `1px solid ${border}`,
                        padding: 14,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        {(["Praha", "Plzeň", "Karlovy Vary"] as City[]).map(
                            (c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() =>
                                        startTransition(() => setCity(c))
                                    }
                                    style={{
                                        minHeight: 40,
                                        borderRadius: 14,
                                        border: `1px solid ${c === city ? accentColor : border}`,
                                        background:
                                            c === city ? surface : "#FFFFFF",
                                        color: textPrimary,
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {c}
                                </button>
                            )
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            marginBottom: 10,
                        }}
                    >
                        {activeCategory} in {city}
                    </div>
                    <div
                        role="tablist"
                        aria-label="Service categories"
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                role="tab"
                                aria-selected={cat === activeCategory}
                                onClick={() =>
                                    startTransition(() =>
                                        setActiveCategory(cat)
                                    )
                                }
                                style={{
                                    minHeight: 40,
                                    borderRadius: 14,
                                    border: `1px solid ${cat === activeCategory ? accentColor : border}`,
                                    background:
                                        cat === activeCategory
                                            ? surface
                                            : "#FFFFFF",
                                    padding: "8px 10px",
                                    fontSize: 13,
                                    color: textPrimary,
                                    cursor: "pointer",
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {activeServices.map((service) => {
                        const key = `${activeCategory}::${service.name}`
                        const qty = quantities[key] || 0
                        return (
                            <div
                                key={key}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto auto",
                                    alignItems: "center",
                                    gap: 10,
                                    background: "#FFFFFF",
                                    border: `1px solid ${border}`,
                                    borderRadius: 16,
                                    padding: 10,
                                    marginBottom: 8,
                                }}
                            >
                                <div style={{ fontSize: 14 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {service.name}
                                    </div>
                                    <div style={{ color: "#4A6385" }}>
                                        CZK {service.price}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    aria-label={`Decrease ${service.name}`}
                                    onClick={() =>
                                        updateQuantity(service.name, -1)
                                    }
                                    style={{
                                        minWidth: 38,
                                        minHeight: 38,
                                        borderRadius: 12,
                                        border: `1px solid ${border}`,
                                        background: "#FFFFFF",
                                        cursor: "pointer",
                                    }}
                                >
                                    −
                                </button>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            minWidth: 20,
                                            textAlign: "center",
                                        }}
                                    >
                                        {qty}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={`Increase ${service.name}`}
                                        onClick={() =>
                                            updateQuantity(service.name, 1)
                                        }
                                        style={{
                                            minWidth: 38,
                                            minHeight: 38,
                                            borderRadius: 12,
                                            border: `1px solid ${accentColor}`,
                                            background: surface,
                                            cursor: "pointer",
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {activeCategory === "Cleaning" && (
                        <div
                            style={{
                                background: surface,
                                borderRadius: 16,
                                border: `1px solid ${border}`,
                                padding: 12,
                                marginTop: 10,
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                Cleaning calculator
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginBottom: 8,
                                }}
                            >
                                {(["apartment", "house"] as const).map(
                                    (type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() =>
                                                startTransition(() =>
                                                    setPropertyType(type)
                                                )
                                            }
                                            style={{
                                                minHeight: 38,
                                                borderRadius: 12,
                                                border: `1px solid ${
                                                    propertyType === type
                                                        ? accentColor
                                                        : border
                                                }`,
                                                background:
                                                    propertyType === type
                                                        ? "#FFFFFF"
                                                        : surface,
                                                padding: "8px 12px",
                                                textTransform: "capitalize",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {type}
                                        </button>
                                    )
                                )}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    flexWrap: "wrap",
                                }}
                            >
                                <label style={{ fontSize: 13 }}>
                                    Rooms
                                    <input
                                        type="number"
                                        min={1}
                                        value={rooms}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setRooms(
                                                    Math.max(
                                                        1,
                                                        Number(
                                                            e.target.value
                                                        ) || 1
                                                    )
                                                )
                                            )
                                        }
                                        style={{
                                            display: "block",
                                            marginTop: 4,
                                            minHeight: 36,
                                            borderRadius: 10,
                                            border: `1px solid ${border}`,
                                            padding: "6px 8px",
                                        }}
                                    />
                                </label>
                                <label style={{ fontSize: 13 }}>
                                    Bathrooms
                                    <input
                                        type="number"
                                        min={0}
                                        value={bathrooms}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setBathrooms(
                                                    Math.max(
                                                        0,
                                                        Number(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                )
                                            )
                                        }
                                        style={{
                                            display: "block",
                                            marginTop: 4,
                                            minHeight: 36,
                                            borderRadius: 10,
                                            border: `1px solid ${border}`,
                                            padding: "6px 8px",
                                        }}
                                    />
                                </label>
                            </div>
                            <div style={{ marginTop: 8, fontWeight: 600 }}>
                                Estimated cleaning: CZK {cleaningEstimate}
                            </div>
                        </div>
                    )}
                </section>

                <section
                    style={{
                        background: "#FFFFFF",
                        borderRadius: 20,
                        border: `1px solid ${border}`,
                        padding: 14,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        {(["When", "Where", "Contact", "Confirm"] as const).map(
                            (s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                        startTransition(() => setStep(s))
                                    }
                                    style={{
                                        minHeight: 38,
                                        borderRadius: 12,
                                        border: `1px solid ${step === s ? accentColor : border}`,
                                        background:
                                            step === s ? surface : "#FFFFFF",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {s}
                                </button>
                            )
                        )}
                    </div>

                    {step === "When" && (
                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                {(
                                    [
                                        "ASAP",
                                        "Today",
                                        "Tomorrow",
                                        "Choose Date",
                                    ] as const
                                ).map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() =>
                                            startTransition(() =>
                                                setWhenOption(opt)
                                            )
                                        }
                                        style={{
                                            minHeight: 38,
                                            borderRadius: 12,
                                            border: `1px solid ${whenOption === opt ? accentColor : border}`,
                                            background:
                                                whenOption === opt
                                                    ? surface
                                                    : "#FFFFFF",
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                            {whenOption === "Choose Date" && (
                                <input
                                    type="date"
                                    value={dateValue}
                                    onChange={(e) =>
                                        startTransition(() =>
                                            setDateValue(e.target.value)
                                        )
                                    }
                                    style={{
                                        marginTop: 10,
                                        minHeight: 40,
                                        borderRadius: 12,
                                        border: `1px solid ${border}`,
                                        padding: "8px 10px",
                                    }}
                                />
                            )}
                            <div
                                style={{
                                    marginTop: 10,
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                {(
                                    ["Morning", "Afternoon", "Evening"] as const
                                ).map((slot) => (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                            startTransition(() =>
                                                setTimeSlot(slot)
                                            )
                                        }
                                        style={{
                                            minHeight: 38,
                                            borderRadius: 12,
                                            border: `1px solid ${timeSlot === slot ? accentColor : border}`,
                                            background:
                                                timeSlot === slot
                                                    ? surface
                                                    : "#FFFFFF",
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === "Where" && (
                        <div>
                            <label
                                style={{
                                    fontSize: 13,
                                    display: "block",
                                    marginBottom: 8,
                                }}
                            >
                                City
                                <select
                                    value={city}
                                    onChange={(e) =>
                                        startTransition(() =>
                                            setCity(e.target.value as City)
                                        )
                                    }
                                    style={{
                                        marginTop: 4,
                                        width: "100%",
                                        minHeight: 40,
                                        borderRadius: 12,
                                        border: `1px solid ${border}`,
                                        padding: "8px 10px",
                                        boxSizing: "border-box",
                                        background: "#FFFFFF",
                                    }}
                                >
                                    {(
                                        [
                                            "Praha",
                                            "Plzeň",
                                            "Karlovy Vary",
                                        ] as City[]
                                    ).map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div
                                style={{
                                    display: "grid",
                                    gap: 8,
                                    gridTemplateColumns: "1fr 1fr",
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 13,
                                        display: "block",
                                        gridColumn: "1 / -1",
                                    }}
                                >
                                    Street
                                    <input
                                        type="text"
                                        value={street}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setStreet(e.target.value)
                                            )
                                        }
                                        placeholder="Street"
                                        style={{
                                            marginTop: 4,
                                            width: "100%",
                                            minHeight: 40,
                                            borderRadius: 12,
                                            border: `1px solid ${border}`,
                                            padding: "8px 10px",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </label>
                                <label
                                    style={{ fontSize: 13, display: "block" }}
                                >
                                    House number
                                    <input
                                        type="text"
                                        value={houseNumber}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setHouseNumber(e.target.value)
                                            )
                                        }
                                        placeholder="e.g. 21"
                                        style={{
                                            marginTop: 4,
                                            width: "100%",
                                            minHeight: 40,
                                            borderRadius: 12,
                                            border: `1px solid ${border}`,
                                            padding: "8px 10px",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </label>
                                <label
                                    style={{ fontSize: 13, display: "block" }}
                                >
                                    Apartment number
                                    <input
                                        type="text"
                                        value={apartmentNumber}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setApartmentNumber(
                                                    e.target.value
                                                )
                                            )
                                        }
                                        placeholder="Optional"
                                        style={{
                                            marginTop: 4,
                                            width: "100%",
                                            minHeight: 40,
                                            borderRadius: 12,
                                            border: `1px solid ${border}`,
                                            padding: "8px 10px",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </label>
                                <label
                                    style={{ fontSize: 13, display: "block" }}
                                >
                                    Floor
                                    <input
                                        type="text"
                                        value={floor}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setFloor(e.target.value)
                                            )
                                        }
                                        placeholder="Optional"
                                        style={{
                                            marginTop: 4,
                                            width: "100%",
                                            minHeight: 40,
                                            borderRadius: 12,
                                            border: `1px solid ${border}`,
                                            padding: "8px 10px",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </label>
                                <label
                                    style={{ fontSize: 13, display: "block" }}
                                >
                                    Doorbell name
                                    <input
                                        type="text"
                                        value={doorbellName}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                setDoorbellName(e.target.value)
                                            )
                                        }
                                        placeholder="Optional"
                                        style={{
                                            marginTop: 4,
                                            width: "100%",
                                            minHeight: 40,
                                            borderRadius: 12,
                                            border: `1px solid ${border}`,
                                            padding: "8px 10px",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </label>
                            </div>
                            <label
                                style={{
                                    fontSize: 13,
                                    display: "block",
                                    marginTop: 8,
                                }}
                            >
                                Full address preview
                                <input
                                    aria-label="Full address preview"
                                    type="text"
                                    value={addressLine}
                                    readOnly
                                    style={{
                                        marginTop: 4,
                                        width: "100%",
                                        minHeight: 40,
                                        borderRadius: 12,
                                        border: `1px solid ${border}`,
                                        padding: "8px 10px",
                                        boxSizing: "border-box",
                                    }}
                                />
                            </label>
                        </div>
                    )}

                    {step === "Contact" && (
                        <div style={{ display: "grid", gap: 8 }}>
                            <input
                                aria-label="Full name"
                                value={name}
                                onChange={(e) =>
                                    startTransition(() =>
                                        setName(e.target.value)
                                    )
                                }
                                placeholder="Full name"
                                style={{
                                    minHeight: 40,
                                    borderRadius: 12,
                                    border: `1px solid ${border}`,
                                    padding: "8px 10px",
                                }}
                            />
                            <input
                                aria-label="Phone number"
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) =>
                                    startTransition(() =>
                                        setPhone(e.target.value)
                                    )
                                }
                                placeholder="Phone (required)"
                                style={{
                                    minHeight: 40,
                                    borderRadius: 12,
                                    border: `1px solid ${border}`,
                                    padding: "8px 10px",
                                }}
                            />
                            <input
                                aria-label="Email address"
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    startTransition(() =>
                                        setEmail(e.target.value)
                                    )
                                }
                                placeholder="Email"
                                style={{
                                    minHeight: 40,
                                    borderRadius: 12,
                                    border: `1px solid ${border}`,
                                    padding: "8px 10px",
                                }}
                            />
                            <textarea
                                value={notes}
                                onChange={(e) =>
                                    startTransition(() =>
                                        setNotes(e.target.value)
                                    )
                                }
                                placeholder="General notes"
                                style={{
                                    minHeight: 72,
                                    borderRadius: 12,
                                    border: `1px solid ${border}`,
                                    padding: "8px 10px",
                                    resize: "vertical",
                                }}
                            />
                        </div>
                    )}

                    {step === "Confirm" && (
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                Order summary
                            </div>
                            <div style={{ fontSize: 14, marginBottom: 6 }}>
                                {selectedItems.length === 0
                                    ? "No selected services yet."
                                    : selectedItems.map((item) => (
                                          <div
                                              key={`${item.category}-${item.name}`}
                                          >
                                              {item.name} — CZK {item.price} ×{" "}
                                              {item.qty} = CZK {item.lineTotal}
                                          </div>
                                      ))}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                When: {whenLabel}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                Time: {timeSlot}
                            </div>
                            <div style={{ marginBottom: 6 }}>City: {city}</div>
                            <div style={{ marginBottom: 6 }}>
                                Street: {street || "—"}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                House number: {houseNumber || "—"}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                Apartment number: {apartmentNumber || "—"}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                Floor: {floor || "—"}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                Doorbell name: {doorbellName || "—"}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                Full address: {addressLine || "—"}
                            </div>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>
                                Total: CZK {grandTotal}
                            </div>
                        </div>
                    )}

                    <label
                        style={{
                            display: "block",
                            marginTop: 10,
                            fontSize: 13,
                        }}
                    >
                        Specific service / What needs to be done
                        <textarea
                            value={serviceTextareaValue}
                            onChange={(e) => {
                                const full = e.target.value
                                const marker = "\n\nAdditional details:\n"
                                const idx = full.indexOf(marker)
                                const extra =
                                    idx >= 0
                                        ? full.slice(idx + marker.length)
                                        : full
                                              .replace(autoServiceText, "")
                                              .trim()
                                startTransition(() =>
                                    setAdditionalDetails(extra)
                                )
                            }}
                            style={{
                                marginTop: 4,
                                width: "100%",
                                minHeight: 96,
                                borderRadius: 12,
                                border: `1px solid ${border}`,
                                padding: "8px 10px",
                                resize: "vertical",
                                boxSizing: "border-box",
                            }}
                        />
                    </label>

                    <input type="hidden" name="city" value={city} />
                    <input
                        type="hidden"
                        name="category"
                        value={activeCategory}
                    />
                    <input
                        type="hidden"
                        name="services"
                        value={JSON.stringify(selectedItems)}
                    />
                    <input
                        type="hidden"
                        name="total"
                        value={String(grandTotal)}
                    />
                    <input type="hidden" name="date" value={whenLabel} />
                    <input type="hidden" name="time" value={timeSlot} />
                    <input type="hidden" name="customer" value={name} />
                    <input type="hidden" name="addressCity" value={city} />
                    <input type="hidden" name="addressStreet" value={street} />
                    <input
                        type="hidden"
                        name="addressHouseNumber"
                        value={houseNumber}
                    />
                    <input
                        type="hidden"
                        name="addressApartmentNumber"
                        value={apartmentNumber}
                    />
                    <input type="hidden" name="addressFloor" value={floor} />
                    <input
                        type="hidden"
                        name="addressDoorbellName"
                        value={doorbellName}
                    />
                    <input type="hidden" name="address" value={addressLine} />
                    <input type="hidden" name="notes" value={notes} />
                    <input
                        type="hidden"
                        name="payload"
                        value={serializedPayload}
                    />

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            type="submit"
                            disabled={submitState === "pending" || isStatic}
                            style={{
                                minHeight: 42,
                                borderRadius: 14,
                                border: `1px solid ${accentColor}`,
                                background: accentColor,
                                color: "#FFFFFF",
                                padding: "10px 14px",
                                cursor:
                                    submitState === "pending" || isStatic
                                        ? "default"
                                        : "pointer",
                            }}
                        >
                            {submitState === "pending"
                                ? "Submitting..."
                                : "Submit booking"}
                        </button>
                        <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                minHeight: 42,
                                borderRadius: 14,
                                border: `1px solid ${border}`,
                                background: "#FFFFFF",
                                color: textPrimary,
                                padding: "10px 14px",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                            }}
                        >
                            WhatsApp Send Photo
                        </a>
                        <a
                            href={contactEmailHref}
                            style={{
                                minHeight: 42,
                                borderRadius: 14,
                                border: `1px solid ${border}`,
                                background: "#FFFFFF",
                                color: textPrimary,
                                padding: "10px 14px",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                            }}
                        >
                            Kontaktovat e-mailem
                        </a>
                    </div>
                    {submitState === "success" && (
                        <div
                            style={{
                                marginTop: 10,
                                color: "#0B6B2E",
                                fontWeight: 600,
                            }}
                        >
                            <div>✓ Žádost o rezervaci byla přijata</div>
                            <div style={{ marginTop: 4 }}>
                                Brzy Vás budeme kontaktovat a potvrdíme
                                dostupnost specialisty, čas a konečnou cenu.
                            </div>
                            <div style={{ marginTop: 6, fontWeight: 500 }}>
                                Město: {city}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 500 }}>
                                Vybrané služby:{" "}
                                {selectedItems.length === 0
                                    ? "Žádné vybrané služby"
                                    : selectedItems
                                          .map(
                                              (item) =>
                                                  `${item.name} × ${item.qty}`
                                          )
                                          .join(", ")}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 500 }}>
                                Preferovaný termín: {whenLabel}, {timeSlot}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 500 }}>
                                Odhadovaná cena: CZK {grandTotal}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 500 }}>
                                Booking ID: {lastBookingId}
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 500 }}>
                                Odesláno: {lastSubmittedDate}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 10,
                                    flexWrap: "wrap",
                                }}
                            >
                                <a
                                    href="#fixly-booking-top"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        if (typeof window !== "undefined") {
                                            window.scrollTo({
                                                top: 0,
                                                behavior: "smooth",
                                            })
                                        }
                                    }}
                                    style={{
                                        minHeight: 42,
                                        borderRadius: 14,
                                        border: `1px solid ${border}`,
                                        background: "#FFFFFF",
                                        color: textPrimary,
                                        padding: "10px 14px",
                                        textDecoration: "none",
                                        display: "inline-flex",
                                        alignItems: "center",
                                    }}
                                >
                                    ZPĚT NA HLAVNÍ STRÁNKU
                                </a>
                                <a
                                    href={successWhatsappHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        minHeight: 42,
                                        borderRadius: 14,
                                        border: `1px solid ${border}`,
                                        background: "#FFFFFF",
                                        color: textPrimary,
                                        padding: "10px 14px",
                                        textDecoration: "none",
                                        display: "inline-flex",
                                        alignItems: "center",
                                    }}
                                >
                                    NAPSAT NÁM NA WHATSAPP
                                </a>
                            </div>
                        </div>
                    )}
                    {submitState === "error" && (
                        <div
                            style={{
                                marginTop: 10,
                                color: "#9E1A1A",
                                fontWeight: 600,
                            }}
                        >
                            <div>{errorMessage}</div>
                            <a
                                href={successWhatsappHref}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    minHeight: 42,
                                    borderRadius: 14,
                                    border: `1px solid ${border}`,
                                    background: "#FFFFFF",
                                    color: textPrimary,
                                    padding: "10px 14px",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    marginTop: 8,
                                }}
                            >
                                NAPSAT NÁM NA WHATSAPP
                            </a>
                        </div>
                    )}
                </section>
            </div>
        </form>
    )
}

addPropertyControls(FixlyBookingEngine, {
    initialCity: {
        type: ControlType.Enum,
        title: "Initial City",
        options: ["Praha", "Plzeň", "Karlovy Vary"],
        optionTitles: ["Praha", "Plzeň", "Karlovy Vary"],
        defaultValue: "Praha",
    },
    whatsappNumber: {
        type: ControlType.String,
        title: "WhatsApp Number",
        defaultValue: "420607563336",
    },
    recipientEmail: {
        type: ControlType.String,
        title: "Recipient Email",
        defaultValue: "",
    },
    webhookUrl: {
        type: ControlType.String,
        title: "Webhook URL",
        defaultValue: "",
    },
    baseApartmentPrice: {
        type: ControlType.Number,
        title: "Base Apartment",
        defaultValue: 1600,
        min: 0,
        step: 50,
    },
    additionalRoomPrice: {
        type: ControlType.Number,
        title: "Add Room",
        defaultValue: 350,
        min: 0,
        step: 50,
    },
    bathroomPrice: {
        type: ControlType.Number,
        title: "Bathroom",
        defaultValue: 280,
        min: 0,
        step: 50,
    },
    houseSurcharge: {
        type: ControlType.Number,
        title: "House Fee",
        defaultValue: 600,
        min: 0,
        step: 50,
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#2F6BFF",
    },
})

