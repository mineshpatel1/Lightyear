#!/usr/bin/python

# Load Google Analytics dimensions based on TSV file
import lyf
import argparse
import csv
import os

from lyf import *
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

parser = argparse.ArgumentParser(description="Extract Google Analytics Dimensions")
parser.add_argument("-f", "--full", action='store_true', default=False, help="Specifies full mode for extract as opposed to incremental.")

args = parser.parse_args()
FULL_MODE = args.full

def main():
	file = os.path.join(lyf.SCRIPT_DIR, lyf.get_config('ETL', 'GA_Dims'))
	
	# Read TSV file, looping through dimensions
	i = 0
	with open(file, 'r') as f:
		f = csv.reader(f, delimiter='\t')
		for row in f:
			if (i > 0):
				table = row[0]
				ga_dims = row[1].split(',')
				columns = row[2].split(',')
				keys = row[3].split(',')
				sql.load_ga_dim(FULL_MODE, table, ga_dims, columns, keys)
			i += 1
			
if __name__ == '__main__':
	main()