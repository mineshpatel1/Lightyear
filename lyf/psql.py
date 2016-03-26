#! /usr/bin/env python
# LYF data integration function library

import lyf, logging
import psycopg2
import codecs
import re

from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

# Class for youtube videos
class DB():
	# Initialiser
	def __init__(self): 
		psql_db = lyf.get_config('POSTGRESQL', 'Database')
		psql_user = lyf.get_config('POSTGRESQL', 'Username')
		psql_schema = lyf.get_config('POSTGRESQL', 'Default_Schema')
		
		self.conn = psycopg2.connect('dbname=%s user=%s' % (psql_db, psql_user))
		self.cursor = self.conn.cursor()
		self.execute("SET search_path = '%s';" % psql_schema)
	
	# Execute SQL and optionally commit or rollback. Return 1 for success, 0 for error
	def execute(self, sql, values=[], commit=False, log=True):
		try:
			self.cursor.execute(sql, values)
			if commit:
				self.conn.commit()
			return(1)
		except Exception as err:
			self.conn.rollback()
			if log:
				logging.error('PSQL Error: %s' % err)
			return(0)
			
	# Truncate table
	def truncate(self, table):
		sql = 'TRUNCATE TABLE %s;' % qualify_schema(table)
		return(self.execute(sql))

	# Insert a single row to a table
	def insert(self, table, row):
		sql = 'INSERT INTO %s (' % qualify_schema(table)
		sql += ', '.join(row.keys())
		sql += ') VALUES ('
		sql += ', '.join(['%s' for key, val in row.items()]) # Placeholders
		sql += ')'
		
		values = [val for key, val in row.items()]
		status = self.execute(sql, values) # Attempt to insert the record
		return(status)
		
	# Insert or update a row to a table
	def upsert(self, table, row, keys):
		table = qualify_schema(table)
		update_cols = [col for col, val in row.items() if col not in keys]
		update_plch = [r'%s' for col, val in row.items() if col not in keys]
		update_vals = [val for col, val in row.items() if col not in keys]
		update_where = [col + ' = %s' for col in keys]
		key_vals = []
		for key in keys:
			key_vals.append(row[key])
		
		insert_cols = [col for col, val in row.items()]
		insert_plch = [r'%s' for col, val in row.items()]
		insert_vals = [val for col, val in row.items()]
		all_vals = update_vals + key_vals + insert_vals
	
		sql = 'WITH upsert AS (UPDATE %s SET (%s) = (%s) ' % (table, ', '.join(update_cols), ', '.join(update_plch))
		sql += 'WHERE %s ' % ' AND '.join(update_where)
		sql += 'RETURNING *) INSERT INTO %s (%s) SELECT %s ' % (table, ', '.join(insert_cols), ', '.join(insert_plch))
		sql += 'WHERE NOT EXISTS (SELECT * FROM upsert);'
		
		status = self.execute(sql, all_vals)
		return(status)
	
	# Query and retrieve the records
	def query(self, sql, vals=[]):
		print(sql)
		print(vals)
		self.cursor.execute(sql, vals)
		print(self.cursor.fetchall())
	
	# Close the cursor and connection. Commit by default
	def close(self, commit=True):
		if commit:
			self.conn.commit()
		self.cursor.close()
		self.conn.close()

# Adds the default schema name to the table if not already present
def qualify_schema(table) :
	if re.search('\.', table) is None:
		table = '%s.%s' % (lyf.get_config('POSTGRESQL', 'Default_Schema'), table)
	return(table)

# Load Google Analytics dimension table
def load_ga_dim(full_mode, table, ga_dims, columns, keys):
	try:
		end_date = date.today().strftime('%Y-%m-%d') # Fetch up to today
		db = connect() # Connect to DB

		if full_mode:
			truncate(db, table) # Truncate table
			
			# Insert 0 row
			primary_key = re.search('d_ga_(.*?)$', table).group(1)
			primary_key += '_id'
			sql = 'INSERT INTO %s (%s) VALUES (-1);' % (table, primary_key)
			db.query(sql)
			db.commit()
			
			start_date = lyf.get_config('ETL', 'Extract_Date')
		else:
			start_date = end_date

		# Connect to Google Analytics
		service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
		metrics = 'ga:sessions'
		dims = ','.join(ga_dims)
		results = lyf.ga_query(service, start_date, end_date, metrics, dims)

		for row in results:
			rec = {}
			i = 0
			for key in columns:
				rec[key] = row[i]
				i += 1
			merge_into_table(db, table, rec, keys)

		db.close()

		if full_mode:
			mode = 'Full'
		else:
			mode = 'Incremental'
		logging.info('Successfully merged %s rows into %s (%s).' % (len(results), table, mode))
	except Exception as err:
		logging.error(err)