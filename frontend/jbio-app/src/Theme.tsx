import { createTheme, Theme, ThemeOptions } from '@mui/material'

let darkThemeBase = createTheme({
    palette: {
        mode: 'dark',
        common: {
            white: "#ffffff",
            black: "#000000"
        },
        text: {
            primary: '#ffffff',
            secondary: '#ffffff',
        },
        primary: {
            main: '#8ea2ff',
        },
        secondary: {
            main: '#555a66',
            light: '#3f4350',
        },
        background: {
            default: '#282b30',
            paper: '#3a3d46',
        },
    },
})

let lightThemeBase = createTheme({
    palette: {
        mode: 'light',
        common: {
            white: "#ffffff",
            black: "#000000"
        },
        text: {
            primary: '#000000',
            secondary: '#000000',
        },
        primary: {
            main: '#4f6edb',
        },
        secondary: {
            main: '#4f6edb',
            light: '#f1f3f9',
        },
        background: {
            default: '#ffffff',
            paper: '#f1f3f9',
        },
    },
})

const createFullTheme = (theme: Theme, extra: ThemeOptions = {}) => createTheme(
    {
        components: {
            MuiCard: {
                styleOverrides: {
                    root: {
                        border: `2px solid ${theme.palette.primary.main}`,
                    },
                },
            },
            MuiCardHeader: {
                styleOverrides: {
                    root: {
                        paddingBottom: 8,
                    },
                    title: {
                        fontWeight: 700,
                        fontSize: '1.2rem',
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        width: 260,
                    },
                },
            },
            MuiSelect: {
                styleOverrides: {
                    root: {
                        backgroundColor: theme.palette.secondary.light,
                        width: 260,
                    },
                    icon: {
                        color: theme.palette.text.primary,
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        backgroundColor: theme.palette.secondary.light,
                    },
                    notchedOutline: {
                        borderColor: theme.palette.secondary.main,
                    },
                },
            },
            MuiSlider: {
                styleOverrides: {
                    track: {
                        border: 'none',
                        color: theme.palette.primary.main,
                    },
                    thumb: {
                        color: theme.palette.common.white,
                    }
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                        color: theme.palette.common.white,
                        backgroundColor: theme.palette.primary.main,
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        backgroundColor: theme.palette.background.default,
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottomWidth: 1,
                        borderColor: theme.palette.secondary.main,
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        variants: [
                            {
                                props: { severity: 'error' },
                                style: {
                                    color: '#ff6b6b',
                                    backgroundColor: '#2a1a1a',
                                    border: '1px solid #ff6b6b',
                                },
                            },
                        ],
                    },
                },
            },
            MuiTableSortLabel: {
                styleOverrides: {
                    icon: {
                        variants: [
                            {
                                props: { active: false },
                                style: {
                                    opacity: 0.3,
                                },
                            },
                        ],
                    },
                },
            },
        },
    },
    theme,
    extra,
)

export const darkTheme = createFullTheme(darkThemeBase)
export const lightTheme = createFullTheme(lightThemeBase, {
    palette: lightThemeBase.palette,
    components: {
        MuiSlider: {
            styleOverrides: {
                thumb: {
                    color: lightThemeBase.palette.primary.main,
                },
            },
        },
    },
})
