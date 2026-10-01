import * as React from 'react'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { useTheme } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import OutlinedInput from '@mui/material/OutlinedInput'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

/*
 * Confusingly, MaterialUI doesn't provide a number field, but has poor support for <input type="number">, explicitly discourages it, and encourages
 * users to copy and paste the below file.
 *
 * https://mui.com/material-ui/react-number-field/
 */

export default function NumberField({
    id: idProp,
    label,
    error,
    size = 'medium',
    formHelper,
    ...other
}: BaseNumberField.Root.Props & {
    formHelper?: string
    label?: React.ReactNode
    size?: 'small' | 'medium'
    error?: boolean
}) {
    const theme = useTheme()
    let id = React.useId()
    if (idProp) {
        id = idProp
    }
    return (
        <BaseNumberField.Root
            {...other}
            render={(props, state) => (
                <FormControl size={size} ref={props.ref} disabled={state.disabled} required={state.required} error={error} variant='outlined'>
                    {props.children}
                </FormControl>
            )}
        >
            <InputLabel htmlFor={id}>{label}</InputLabel>
            <BaseNumberField.Input
                id={id}
                render={(props, state) => (
                    <OutlinedInput
                        aria-describedby={`${id}-helper-text`}
                        label={label}
                        inputRef={props.ref}
                        value={state.inputValue}
                        onBlur={props.onBlur}
                        onChange={props.onChange}
                        onKeyUp={props.onKeyUp}
                        onKeyDown={props.onKeyDown}
                        onFocus={props.onFocus}
                        slotProps={{
                            input: props,
                        }}
                        endAdornment={
                            <InputAdornment
                                position='end'
                                sx={{
                                    flexDirection: 'column',
                                    maxHeight: 'unset',
                                    alignSelf: 'stretch',
                                    borderLeft: '1px solid',
                                    borderColor: theme.palette.secondary.main,
                                    ml: 0,
                                    '& button': {
                                        py: 0,
                                        flex: 1,
                                        borderRadius: 0.5,
                                    },
                                }}
                            >
                                <BaseNumberField.Increment render={<IconButton size={size} aria-label='Increase' sx={{ color: theme.palette.text.primary }} />}>
                                    <KeyboardArrowUpIcon fontSize={size} sx={{ transform: 'translateY(2px)' }} />
                                </BaseNumberField.Increment>

                                <BaseNumberField.Decrement render={<IconButton size={size} aria-label='Decrease' sx={{ color: theme.palette.text.primary }} />}>
                                    <KeyboardArrowDownIcon fontSize={size} sx={{ transform: 'translateY(-2px)' }} />
                                </BaseNumberField.Decrement>
                            </InputAdornment>
                        }
                        sx={{ pr: 0 }}
                    />
                )}
            />
            {formHelper && (
                <FormHelperText id={`${id}-helper-text`} sx={{ ml: 0, '&:empty': { mt: 0 } }}>
                    {formHelper}
                </FormHelperText>
            )}
        </BaseNumberField.Root>
    )
}
