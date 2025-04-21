# E-commerce Conversion Funnel Visualization

## Overview
This project visualizes an e-commerce conversion funnel using a funnel chart. It helps analyze user drop-off rates at different stages of the purchase journey.
## Data Used
Data is taken from Kaggle - User Funnels Dataset, a dataset of user behavior in e-commerce sites. This dataset provides information on the number of users at each stage in the purchase process.
## Funnel Chart Explanation
A funnel chart represents the sequential stages in a process and highlights the decreasing number of users progressing through each stage. It is commonly used in e-commerce analytics to track user engagement and conversion rates.

## Stages in the Funnel
The funnel consists of the following stages:
1. **Homepage** - The entry point where users land on the website.
2. **Product Page** - Users browse products they are interested in.
3. **Cart** - Users add selected products to their shopping cart.
4. **Checkout** - Users proceed to purchase and enter payment details.
5. **Purchase** - Successful transaction completion.

## Features
- **Custom Order Sorting**: The chart arranges the stages in a meaningful sequence.
- **User Drop-off Analysis**: Helps identify at which stage users abandon the process.
- **Interactive Visualization**: Uses Plotly for dynamic exploration.

## Installation & Usage
1. Install dependencies:
   ```bash
   pip install plotly pandas
   ```
## Example Outdput
The script generates an interactive funnel chart showing user progression through each stage, making it easier to analyze conversion trends.

## License
This project is open-source and available under the MIT License.

