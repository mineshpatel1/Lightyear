#!/usr/bin/python

# Load Google Analytics dimensions based on TSV file
import lyf, logging
import argparse
import csv
import os

from lyf import psql
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

	if FULL_MODE:
		try:
			db = psql.DB()

			# Reload country table
			countries_file = os.path.join(lyf.SCRIPT_DIR, 'data', 'countries.csv')
			db.truncate('d_country')
			db.reset_seq('d_country', 'country_id')
			db.load_csv('d_country', countries_file)
			db.close()
			logging.info('Reloaded d_country table.')
		except Exception as err:
			logging.error(err)

	with open(file, 'r') as f:
		f = csv.reader(f, delimiter='\t')
		for row in f:
			if (i > 0):
				if (len(row) > 0):
					table = row[0]
					ga_dims = row[1].split(',')
					columns = row[2].split(',')
					keys = row[3].split(',')

					psql.load_ga_dim(FULL_MODE, table, ga_dims, columns, keys)
			i += 1

	# Post load processing
	try:
		db = psql.DB()

		# Update geography dimension to lookup country codes from Google Analytics
		db.lookup('d_ga_geo', 'd_country', ['country'], ['country'], ['country_code'], ['country_code'])
		logging.info('Updated %s country codes in d_ga_geo.' % db.cursor.rowcount)

		# Update the page table to apply any information about blog authors that can be found
		end_date = date.today().strftime('%Y-%m-%d')
		if FULL_MODE:
			start_date = lyf.get_config('ETL', 'Extract_Date')
		else:
			start_date = end_date

		service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
		metrics = 'ga:sessions'
		dims = 'ga:pageTitle,ga:contentGroup1,ga:contentGroup2'
		filters = 'ga:contentGroup1==Blog;ga:contentGroup2!=(not set)'
		results = lyf.ga_query(service, start_date, end_date, metrics, dims, filters)

		updated_pages = 0
		for row in results:
			rec = { 'page_type' : row[1], 'author' : row[2] }
			filter_rec = { 'page_title' : row[0] }
			status = db.update('d_ga_page', rec, filter_rec)
			if status == 1:
				updated_pages += 1

		if updated_pages > 0:
			logging.info('Updated %s page entries with Blog and Author info.' % updated_pages)

		db.close()
	except Exception as err:
		logging.error(err)

if __name__ == '__main__':
	main()
