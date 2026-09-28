import { createTheme } from '@mui/material'

let theme = createTheme({
    palette: {
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

theme = createTheme(
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
                        color: '#ffffff',
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
                    },
                    thumb: {
                        color: '#ffffff',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
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
)

export default theme
