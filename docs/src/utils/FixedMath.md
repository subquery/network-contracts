# Solidity API

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

