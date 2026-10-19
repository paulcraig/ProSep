import NumberField from '../../ui/NumberField'

export function SaltSettings({
    saltStart,
    setSaltStart,
    saltEnd,
    setSaltEnd,
    saltAlpha,
    setSaltAlpha,
}: {
    saltStart: number
    setSaltStart: (value: number) => void
    saltEnd: number
    setSaltEnd: (value: number) => void
    saltAlpha: number
    setSaltAlpha: (value: number) => void
}) {

    function setStart(value: number | null) {
        setSaltStart(value == null ? 0 : value)
    }

    function setEnd(value: number | null) {
        setSaltEnd(value == null ? 0 : value)
    }

    function setAlpha(value: number | null) {
        setSaltAlpha(value == null ? 0 : value)
    }

    return (<>
        <NumberField label='Salt Start' value={saltStart} min={0} max={2} onValueCommitted={setStart} />
        <NumberField label='Salt End' value={saltEnd} min={0} max={2} onValueCommitted={setEnd} />
        <NumberField label='Salt Alpha' value={saltAlpha} min={0} max={2} onValueCommitted={setAlpha} />
    </>)
}
